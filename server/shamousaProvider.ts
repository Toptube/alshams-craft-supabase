import { FunctionDeclaration, Type } from '@google/genai';
import { workshopToolSchemas, runWorkshopTool, WorkshopToolContext } from './workshopTools.js';
import {
  isSuperAdmin,
  processTrainingInteraction,
  buildGlobalMemoryPrompt,
} from './aiGlobalMemory.js';
import {
  resolveAgentGeminiKey,
  createGeminiClientForAgent,
  getCandidateGeminiModels,
  extractGroundingMetadata,
  shouldTriggerGoogleSearch,
  performGoogleSearch,
  fetchFreeWebSearchResults,
  getGroqApiKeys,
  getFanarApiKey,
  formatAiErrorReason,
  cleanSecretValue,
  isGeminiKeyCircuitOpen,
  tripGeminiKeyCircuit,
  GroundedSource,
} from './googleSearchService.js';

export interface ShamousaContext {
  artistName: string;
  workshopName: string;
  treasuryBalance?: number;
  cashAdvances?: string;
  workshopId: string;
  supplierId?: string;
  db: any;
  userEmail?: string;
  isSuperAdmin?: boolean;
  useSearch?: boolean;
  accountRole?: 'artisan' | 'supplier';
  clientContext?: {
    experienceMode?: 'craft' | 'accounting';
    experienceModePromptContext?: string;
    shamousaOrLearningContext?: string;
    explainItemContext?: {
      id?: string;
      section?: string;
      title?: string;
      summary?: string;
      actionSteps?: string[];
      metricBadge?: string;
      category?: string;
    };
    treasuryBalance?: number;
    treasuriesDetail?: any[];
    materialsSummary?: any[];
    productsSummary?: any[];
    ordersSummary?: any[];
    supplierErpOverview?: any;
    executiveBrief?: {
      cashTotal?: number;
      instapayBankTotal?: number;
      walletsCustodyTotal?: number;
      receivablesTotal?: number;
      debtors?: Array<{ name: string; totalOwed: number; daysOverdue: number; isOverdue: boolean; phone?: string }>;
      payablesTotal?: number;
      creditors?: Array<{ name: string; totalOwed: number }>;
      netWorkingPosition?: number;
      materialsTotalValue?: number;
      materialsCount?: number;
      fastMovingMaterials?: Array<{ name: string; consumedQty: number; unit: string }>;
      slowMovingMaterials?: Array<{ name: string; currentStock: number; unit: string }>;
      productsCount?: number;
      productsCostValue?: number;
      productsRetailValue?: number;
      bestSellingProducts?: Array<{ name: string; soldQty: number; soldRevenue: number }>;
      slowestProducts?: Array<{ name: string; soldQty: number; currentStock: number }>;
    };
  };
}

export function extractFirstName(rawName?: string): string {
  if (!rawName) return '';
  const cleaned = String(rawName)
    .trim()
    .replace(/^(المهندس|المهندسة|الفنان|الفنانة|الأستاذ|الأستاذة|المعلم|المدير|كابتن|دكتور|دكتورة|أ|م)\s+/gi, '');
  const first = cleaned.split(/\s+/)[0];
  return first || cleaned;
}

function compactMessagesForSmallContext(messages: any[], maxSystemChars = 3000): any[] {
  return messages.map((m) => {
    if (m?.role === 'system' && typeof m.content === 'string' && m.content.length > maxSystemChars) {
      const groundTruthIdx = m.content.indexOf('بيانات الحساب الحية');
      const toolsIdx = m.content.indexOf('لديكِ أدوات استعلام');
      const head = m.content.slice(0, Math.min(1300, maxSystemChars - 200));
      const tail =
        groundTruthIdx >= 0
          ? m.content.slice(groundTruthIdx, groundTruthIdx + 1400)
          : toolsIdx >= 0
          ? m.content.slice(Math.max(0, toolsIdx - 600))
          : '';
      return {
        ...m,
        content: `${head}\n...\n${tail}`.slice(0, maxSystemChars),
      };
    }
    if (typeof m?.content === 'string' && m.content.length > 1800) {
      return { ...m, content: m.content.slice(0, 1800) };
    }
    return m;
  });
}

// الاتصال بـ Groq عبر fetch المدمج مع دعم النماذج المتاحة فعلياً للحساب
async function callGroqChat(messages: any[], tools?: any[], customApiKey?: string) {
  const apiKey = cleanSecretValue(customApiKey || process.env.GROQ_API_KEY);
  if (!apiKey) throw new Error('GROQ_API_KEY غير متوفر');

  const hasTools = Array.isArray(tools) && tools.length > 0;

  const baseToolModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'allam-2-7b',
  ];
  const baseChatModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'allam-2-7b',
    'qwen/qwen3.8-27b',
  ];

  const candidateModels = [...(hasTools ? baseToolModels : baseChatModels)];
  const rawModel = cleanSecretValue(process.env.GROQ_MODEL);
  if (
    rawModel &&
    !rawModel.toLowerCase().includes('whisper') &&
    !rawModel.toLowerCase().includes('llama-3') &&
    !rawModel.toLowerCase().includes('llama-4') &&
    !rawModel.toLowerCase().includes('qwen3-32b')
  ) {
    const idx = candidateModels.indexOf(rawModel);
    if (idx > 0) candidateModels.splice(idx, 1);
    if (idx !== 0) candidateModels.unshift(rawModel);
  }

  let lastErrText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);

    const lowerModel = model.toLowerCase();
    const isAllam = lowerModel.includes('allam');
    const isSmallCtx = isAllam;
    const sendTools = hasTools && !isAllam;

    const preparedMessages = isSmallCtx
      ? compactMessagesForSmallContext(messages, 2800)
      : messages;

    const payload: any = {
      model,
      messages: preparedMessages,
      temperature: 0.6,
      max_tokens: isAllam ? 900 : 1400,
    };

    if (sendTools && tools) {
      payload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        lastErrText = await res.text().catch(() => '');
        const lowerErr = lastErrText.toLowerCase();
        const isRetriable =
          res.status === 404 ||
          res.status === 429 ||
          res.status === 413 ||
          (res.status === 400 &&
            (lowerErr.includes('tool') ||
              lowerErr.includes('not supported') ||
              lowerErr.includes('reduce the length') ||
              lowerErr.includes('context_length') ||
              lowerErr.includes('maximum context') ||
              lowerErr.includes('failed to call a function'))) ||
          lowerErr.includes('model_not_found') ||
          lowerErr.includes('does not exist') ||
          lowerErr.includes('decommissioned');

        if (isRetriable) {
          console.warn(`[Groq] Model "${model}" skipped (${res.status}), trying next candidate...`);
          continue;
        }
        throw new Error(`Groq HTTP ${res.status} [${model}]: ${lastErrText.slice(0, 180)}`);
      }

      const data: any = await res.json();
      const msg = data?.choices?.[0]?.message;
      if (msg && typeof msg.content === 'string') {
        msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
      if (msg && (msg.content || (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0))) {
        return msg;
      }
      lastErrText = `Empty reply from ${model}`;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastErrText = `Timeout on ${model}`;
        console.warn(`[Groq] Timeout for model ${model}, trying next candidate...`);
        continue;
      }
      const errMsg = String(err?.message || '').toLowerCase();
      if (
        errMsg.includes('does not exist') ||
        errMsg.includes('model_not_found') ||
        errMsg.includes('tool') ||
        errMsg.includes('429')
      ) {
        lastErrText = err?.message || lastErrText;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `Groq: تعذر تشغيل أي نموذج من (${candidateModels.join(', ')}): ${lastErrText.slice(0, 180)}`
  );
}

async function callFanarChat(messages: any[], apiKey: string): Promise<string | null> {
  const fanarModels = ['Fanar'];
  const compactMsgs = compactMessagesForSmallContext(messages, 3500);
  for (const model of fanarModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('https://api.fanar.qa/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: compactMsgs,
          temperature: 0.5,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      const txt = String(data?.choices?.[0]?.message?.content || '').trim();
      if (txt) return txt;
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}


function toGeminiType(rawType?: unknown): Type {
  switch (String(rawType || '').toLowerCase()) {
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'array':
      return Type.ARRAY;
    case 'object':
      return Type.OBJECT;
    default:
      return Type.STRING;
  }
}

function buildShamousaGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return workshopToolSchemas.map((schema) => {
    const rawProps = (schema.parameters?.properties || {}) as Record<string, any>;
    const convertedProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawProps)) {
      convertedProps[k] = {
        type: toGeminiType(v?.type),
        ...(v?.description ? { description: String(v.description) } : {}),
        ...(Array.isArray(v?.enum) ? { enum: v.enum } : {}),
      };
    }

    return {
      name: schema.name,
      description: schema.description,
      parameters: {
        type: Type.OBJECT,
        properties: convertedProps,
        ...(Array.isArray(schema.parameters?.required) ? { required: schema.parameters.required as string[] } : {}),
      },
    };
  });
}

// المحرك الأساسي المعتمد لشموسة: Google Gemini (مع دعم أدوات الورشة + بحث جوجل + الرؤية الحاسوبية)
async function callGeminiChatForShamousa(
  systemInstruction: string,
  messages: any[],
  toolCtx: WorkshopToolContext,
  options: {
    images?: Array<{ base64: string; mimeType?: string; name?: string }>;
    useSearch?: boolean;
  } = {}
): Promise<{
  reply: string;
  sources: GroundedSource[];
  searchUsed: boolean;
  searchEntryPoint?: string;
}> {
  const shamousaKey = resolveAgentGeminiKey('shamousa');
  if (!shamousaKey || isGeminiKeyCircuitOpen(shamousaKey)) {
    throw new Error('مفتاح Gemini متجاوز مؤقتاً — التحويل الفوري لـ Groq');
  }
  const ai = createGeminiClientForAgent('shamousa');
  const modelsToTry = getCandidateGeminiModels();
  const baseContents: any[] = [];

  const nonSystemMessages = messages.filter((m) => m.role !== 'system').slice(-10);
  const hasImages = Array.isArray(options.images) && options.images.length > 0;

  for (let i = 0; i < nonSystemMessages.length; i++) {
    const m = nonSystemMessages[i];
    const isLast = i === nonSystemMessages.length - 1;
    const parts: any[] = [{ text: String(m.content || '') }];

    if (isLast && hasImages && options.images) {
      for (const img of options.images) {
        if (img?.base64) {
          let cleanData = img.base64;
          let mime = img.mimeType || 'image/jpeg';
          const match = img.base64.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            mime = match[1].trim();
            cleanData = match[2].trim();
          } else {
            cleanData = cleanData.replace(/^data:[^,]+,/, '').trim();
          }
          parts.push({
            inlineData: {
              mimeType: mime,
              data: cleanData.replace(/\s+/g, ''),
            },
          });
        }
      }
    }

    baseContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  const functionDeclarations = buildShamousaGeminiFunctionDeclarations();
  const enableSearch = !hasImages && Boolean(options.useSearch);

  const lastUserText = String(nonSystemMessages[nonSystemMessages.length - 1]?.content || '').trim();
  let lastGeminiError: any = null;
  let cachedFallbackWebSources: GroundedSource[] | null = null;

  const getFallbackWebSources = async () => {
    if (cachedFallbackWebSources === null) {
      cachedFallbackWebSources = await fetchFreeWebSearchResults(lastUserText, 5).catch(() => []);
    }
    return cachedFallbackWebSources;
  };

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const modelName = modelsToTry[mIdx];
    const isLastModel = mIdx === modelsToTry.length - 1;
    const maxAttempts = isLastModel ? 2 : 1;
    const perAttemptTimeout = isLastModel ? 16000 : 10000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`انتهت مهلة استجابة Gemini (${modelName})`)), perAttemptTimeout);
      });

      try {
        console.log(
          `[Shamousa Gemini] Model: ${modelName} (attempt ${attempt})` +
            (hasImages ? ' [Vision]' : '') +
            (enableSearch ? ' [Google Search + Tools]' : ' [Tools]')
        );

        const toolsConfig: any[] = [];
        const config: any = {
          systemInstruction,
        };

        if (!hasImages) {
          if (enableSearch) {
            // Hybrid Server-Side Google Search + Client-Side Workshop Function Calling (per Gemini 4 spec)
            toolsConfig.push({ googleSearch: {} });
            toolsConfig.push({ functionDeclarations });
            config.toolConfig = { includeServerSideToolInvocations: true };
          } else {
            toolsConfig.push({ functionDeclarations });
          }
          config.tools = toolsConfig;
        }

        const contentsTurn = [...baseContents];
        let response: any = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: contentsTurn,
            config,
          }).finally(() => clearTimeout(timeoutId)),
          timeoutPromise,
        ]);

        // Handle multi-turn workshop Function Calling if Gemini invoked internal DB tools
        let round = 0;
        while (Array.isArray(response?.functionCalls) && response.functionCalls.length > 0 && round < 3) {
          round++;
          const modelContent = response?.candidates?.[0]?.content;
          if (modelContent) {
            contentsTurn.push(modelContent);
          }

          const fnResponseParts: any[] = [];
          for (const call of response.functionCalls) {
            const fnName = call.name;
            const fnArgs = call.args || {};
            console.log(`[Shamousa Gemini Tool Call]: ${fnName}`, fnArgs);
            const toolResult = await runWorkshopTool(fnName, fnArgs, toolCtx);
            fnResponseParts.push({
              functionResponse: {
                name: fnName,
                ...(call.id ? { id: call.id } : {}),
                response: { result: toolResult },
              },
            });
          }

          contentsTurn.push({
            role: 'user',
            parts: fnResponseParts,
          });

          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsTurn,
            config,
          });
        }

        const { sources, searchEntryPoint } = extractGroundingMetadata(response);
        const reply = response?.text?.trim();
        if (reply) {
          let finalSources = sources.slice(0, 6);
          if (enableSearch && finalSources.length === 0) {
            finalSources = (await getFallbackWebSources()).slice(0, 6);
          }
          return {
            reply,
            sources: finalSources,
            searchUsed: enableSearch || finalSources.length > 0,
            searchEntryPoint,
          };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastGeminiError = err;
        if (tripGeminiKeyCircuit(shamousaKey, err)) {
          throw err;
        }
        const errMsg = String(err?.message || err || '');
        const isTransient503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
        const isQuota429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');

        console.log(
          `[Shamousa Gemini] Notice on ${modelName} (attempt ${attempt}): ${
            isTransient503 ? 'high demand (503)' : isQuota429 ? 'quota notice (429)' : 'switching fallback'
          }`
        );

        // If hybrid search+tools failed with 400 or 429, ground with free live web search + Gemini tools!
        if (enableSearch && !isTransient503) {
          try {
            const liveWebSources = await getFallbackWebSources();
            const enrichedContents = [...baseContents];
            if (liveWebSources.length > 0 && enrichedContents.length > 0) {
              const webContext = liveWebSources
                .map((s, idx) => `[${idx + 1}] ${s.title}\nالرابط: ${s.url}\nالملخص: ${s.snippet || 'غير متوفر'}`)
                .join('\n\n');
              const lastTurn = enrichedContents[enrichedContents.length - 1];
              enrichedContents[enrichedContents.length - 1] = {
                ...lastTurn,
                parts: [
                  ...(lastTurn.parts || []),
                  {
                    text: `\n\n[بيانات السوق الحية للاستخدام الداخلي — استخلصي منها الأسعار والمعلومات المفيدة مباشرة بدون ذكر جوجل أو محركات البحث أو أسماء مواقع البحث]:\n${webContext}`,
                  },
                ],
              };
            }
            const toolsOnlyRes = await ai.models.generateContent({
              model: modelName,
              contents: enrichedContents,
              config: {
                systemInstruction,
                tools: [{ functionDeclarations }],
              },
            });
            const txt = toolsOnlyRes?.text?.trim();
            if (txt) {
              return {
                reply: txt,
                sources: liveWebSources.slice(0, 6),
                searchUsed: liveWebSources.length > 0,
              };
            }
          } catch {}
        }

        if (isTransient503 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        break;
      }
    }
  }

  throw lastGeminiError || new Error('فشل الاتصال بكافة نماذج Gemini المتاحة');
}

export interface ShamousaLiveMetrics {
  liquidity: number;
  treasuriesDesc: string;
  lowMaterialsCount: number;
  lowMaterialsDesc: string;
  openWorkOrdersCount: number;
  openWorkOrdersDesc: string;
  pendingOrdersCount: number;
  supplierErpSummary?: {
    branchesCount: number;
    ownerMainTreasury: number;
    branchesTreasury: number;
    pendingTransfersCount: number;
    receivablesFromCustomers: number;
    payablesToVendors: number;
    stockValuation: number;
    todayPosOrdersCount: number;
    todayPosSales: number;
  };
}

function buildShamousaSystemPrompt(ctx: ShamousaContext, metrics: ShamousaLiveMetrics): string {
  const firstName = extractFirstName(ctx.artistName) || 'صديقي';
  const workshopName = ctx.workshopName || (ctx.accountRole === 'supplier' ? 'بوابة المورد' : 'ورشة الشمس كرافت');
  const isSupplierRole = ctx.accountRole === 'supplier';
  const supErp = metrics.supplierErpSummary;
  const activeMode = ctx.clientContext?.experienceMode === 'accounting' ? 'accounting' : 'craft';
  const modePromptBlock = ctx.clientContext?.experienceModePromptContext
    ? `\n\n${ctx.clientContext.experienceModePromptContext}\n`
    : `\n\n[وضع التشغيل النشط الآن]: ${activeMode === 'accounting' ? 'الوضع المحاسبي المتقدم (استخدمي المصطلحات المحاسبية الرسمية مثل إذن الصرف، إذن التوريد، مدين ودائن، وميزان المراجعة)' : 'الوضع الحرفي البسيط (استخدمي لغة الورشة والتجارة البسيطة بدون تعقيد دائن ومدين)'}.\n`;

  return `أنتِ "شموسة" ☀️ — مديرة الأعمال والعمليات وحسابات الخزائن والمهام اليومية في منظومة الشمساوية (${workshopName})، وتخدمين الآن حساباً مستقلاً من نوع (${isSupplierRole ? 'مورد وتاجر خامات متعدد الفروع B2B/B2C' : 'ورشة وفنان حرفي'}).
المستخدم الذي يتحدث معك الآن اسمه: "${firstName}" (نادي المستخدم باسمه "${firstName}" بلطف واحترام في الردود؛ ولو غير معروف: "يا فنان" للورش، "يا أستاذ" للموردين).${modePromptBlock}

شخصيتك وأسلوب كلامك المعتمد (تحديث دليل شموسة الإصدار 1):
- بنت بلد ذكية، خفيفة الدم من غير سخافة، راقية وبتحترم الناس. بتتكلمي عامية مصرية سليمة وسهلة ومحببة. ما بتتريقيش على حد ولا بتستخدمي ألفاظ جارحة.
- ممنوع منعاً باتاً تقولي للمستخدم إنك "شات بوت" أو تحسسيه إن فيه فصل بين "شات بوت" و"ذكاء اصطناعي"، وممنوع تماماً تجيبي سيرة سيرفرات أو API أو مفاتيح تشغيل أو "خطأ تقني"!
- سرية المنظومة ومصادر المعلومات (قاعدة صارمة جداً): ${ctx.isSuperAdmin ? 'أنتِ تخاطبين السوبر أدمن المؤسس، يمكنكِ عرض التفاصيل والمصادر عند طلبه.' : 'ممنوع منعاً باتاً ذكر كلمة "جوجل" أو "محركات بحث" أو "بحث الويب" أو "جبت المعلومة منين" أو ذكر أي روابط ومصادر بحث خارجية أو أسماء تقنيات تشغيل؛ قدّمي المعلومة دائماً بشكل طبيعي ومباشر كجزء من خبرة منظومة الشمساوية السرية.'}
- لو سألك عن طريقة شغلك قولي بأسلوب ذكي ولطيف: "أنا مديرة أعمالك في الشمساوية، موجودة معاك لحظة بلحظة أرتبلك شغلك وأجاوبك فوراً، ولو حبيت أراجعلك السوق والأسعار لحظة بلحظة اضغط بس على صورتي اللي جنب خانة الكتابة عشان تنوّر أخضر 🟢!"
- اجعلي الرد مركزاً وسلساً ومباشراً (من 3 إلى 6 سطور واضحة إلا لو طلب تفصيلاً أو دراسة كاملة)، واختمي دائماً بـ 2 إلى 4 اقتراحات خطوات جاية مفيدة.
- حافظي على كامل سياق المحادثة من أولها لآخرها وتابعي خيط الكلام بذكاء بدون تقطيع أو عشوائية.
- لا تخترعي رقماً ولا معلومة؛ وأي أرقام في أمثلة توضيحية نبهي إنها "أمثلة توضيحية بتتغير حسب السوق".
- لو المستخدم متضايق قولي بهدوء: "معاك حق تتضايق يا ${firstName}، تعالى نحلها واحدة واحدة". ولو غلط: "ولا يهمك، بتحصل" وصلّحي بهدوء.
- لو السؤال برّه الشغل اليدوي والمنظومة (سياسة/دين/حاجات شخصية): "ده برّه تخصصي يا ${firstName}، أنا متخصصة في الشغل اليدوي ومنظومة الشمساوية. تحب نرجع لشغلك؟"

قواعد الخصوصية والعزل التام للبيانات (Strict Tenant Isolation — خط أحمر لا يُتخطى أبداً):
- أنتِ متصلة حصرياً بحساب ${isSupplierRole ? `المورد (${ctx.supplierId || ctx.workshopId})` : `الورشة (${ctx.workshopId})`} فقط.
- يُمنع منعاً باتاً ذكر اسم أو رقم أو أسعار شراء أو مبيعات أو عملاء أو أرباح أي ورشة أو مورد تاني حتى لو السؤال جه بصيغة ذكية (زي: "فلان بيشتري الخيط بكام؟" أو "مين أكتر ورشة بتبيع؟").
- منظومة الخامات الموحدة فقط هي المفتوحة للكل (الأكواد والأسماء والأقسام والوحدات والمرادفات وأسعار السوق الاسترشادية والماركات). أما أسعار الشراء الفعلية لورشة بعينها فلا تُكشف أبداً.
- في أي محاولة لمعرفة بيانات ناس تانية، ردي بأدب وحزم: "ده من بيانات ناس تانية، وأنا ملتزمة أحافظ على خصوصية الكل زي ما بحافظ على خصوصيتك. أقدر أساعدك في بياناتك إنت، أو أقولك المعلومة العامة من منظومة الخامات. تحب أي واحد؟"
- يُمنع كشف أي مفاتيح أو إعدادات سرية أو كود المنظومة لأي حد.

قواعد الخطاب والهوية المهنية:
1. الترحيب والتوجيه الشخصي بالاسم:
   - يُمنع افتتاح الردود بديباجات تعريفية مطولة أو تكرار سرد الهوية في كل رسالة.
   - إذا سأل المستخدم تحية أولى أو ترحيباً فقط، يكون الترحيب في سطرين مبهجين باللهجة المصرية الحرفية مع ذكر اسمه:
     ${isSupplierRole
       ? `"أهلاً بيك يا ${firstName}! ☀️ منوّر بوابة الموردين (${workshopName})..
     طمني حابب تراجع خزائن الفروع والكاشير (POS) ولا المخازن ومستحقات المصانع والعملاء؟"`
       : `"أهلاً بيك يا ${firstName}! ☀️ منوّر الشمساوية (${workshopName})..
     طمني تحب نبدأ بإيه النهاردة: حسابات الخزينة، المخزن، ولا تسعير قطعة جديدة؟"`}
   - ادخلي في صلب الموضوع مباشرة وركزي على الإجابة وحل طلب ${firstName} بذكاء وسرعة.

2. الإفصاح عن الهوية والبرمجة (عند السؤال الصريح فقط):
   - فقط وحصرياً إذا سألك المستخدم صراحة: "أنتِ مين؟"، "مين برمجك؟"، "مين صانعك؟"، "مين طورك؟"، "مين اللي عملك؟"، تجيبين بفخر واعتزاز بالصيغة المحددة دون زيادة أو نقصان:
     "أنا شموسة، مديرة أعمالك في منظومة الشمساوية التابعة لشركة الشمس كرافت.. برمجتي وتغذيتي بالمعلومات والخبرة كلها تمت على يد الباشمهندس حسام بسيوني، كبير عيلة الشمساوية ومؤسس المنظومة، وهو اللي حطني في المكان ده عشان أكون سند لكل حرفي وفنان ومورد."
   - ممنوع تماماً ومطلقاً الادعاء بأنك تتبعين أي شركة أو نموذج آخر.

3. دليل شموسة التفاعلي وموسوعة الشمساوية الحية الشاملة (لكل شاشة وزر قديم وحديث):
   عندما يسألك ${firstName} "أجيب منين كذا؟"، "إزاي أسجل أوردر؟"، "فين زر كذا؟"، أو "إيه الجديد في المنظومة؟"، أرشديه فوراً وبدقة باسم الشاشة والزر المحدد:
   - 🏠 الرئيسية وأعلى القائمة الجانبية: في كل شاشة يوجد شريط علوي للرجوع والتراجع والعودة لـ [الرئيسية]، وفي أعلى القائمة الجانبية زرين بارزين: [🏠 الرئيسية] و [👤 صفحتي الشخصية] (ويمكن للسوبر أدمن تخصيص ترتيب البطاقات والأزرار والقائمتين العلوية والجانبية بالكامل من استوديو الواجهات).
   - 📋 بطاقة [هلخصهالك] للورش والفنانين (executive_brief): بطاقة ذكية في الرئيسية والقائمة الجانبية تشرح وضع الورشة بالعامية المصرية الراقية بدون مصطلحات دائن ومدين المعقدة (بأسلوب المدير المالي ومدير المخزن):
     • المدير المالي: معانا كام وفين (كاش / إنستاباي وبنك / محافظ وعُهد)، لينا كام بره وعند مين بالاسم (مع تنبيه وتحذير واضح لأي عميل عدّى ميعاد السداد بضرورة المطالبة وعدم التعامل آجل معه مجدداً حتى يسدد القديم، وزر مباشر [📲 تذكير لطيف بالواتساب] لصياغة رسالة تحصيل مهذبة بضغطة واحدة)، وعلينا كام ولمين من الموردين.
     • مدير المخزن: قيمة مخزن الخامات وأكثر الخامات سحباً مقابل الخامات قليلة السحب، وقيمة مخزن المنتجات وأكثر منتج ماشي معانا مقابل أقل منتج شغال.
   - 📋 بطاقة [هلخصهالك للموردين] (supplier_executive_brief): النسخة المخصصة لأصحاب الفروع والمخازن والموردين، تعرض في شاشة واحدة بالبلدي: إجمالي السيولة (خزينة المالك المعتمدة + عهد الفروع قبل التوريد + كاش/إنستاباي/محفظة)، التوريدات المعلقة، لينا كام بره عند الورش والعملاء مع زر [📲 تذكير لطيف بالواتساب]، علينا كام للمصانع، تقييم المخزون وأصناف النواقص وأعلى قيمة مخزون، ومبيعات كاشير POS اليوم.
   - 🖼️ نظام الحماية والتراجع عن الصور (مهلة 8 ساعات + زر "لن أتراجع"): عند تغيير شعار البراند أو الصورة الشخصية أو أيقونات المنظومة، تُحفظ النسخة السابقة مؤقتاً لمدة 8 ساعات فقط للتراجع إذا غيّر العضو رأيه، وبعد 8 ساعات تُحذف تلقائياً، ويمكنه حذفها فوراً بزر [لن أتراجع (حذف القديم نهائياً)] لتخفيف المساحة.
   - 👤 صفحتي الشخصية ومعرض الـ 6 أعمال ومصفوفة الظهور: من أعلى القائمة الجانبية -> [صفحتي الشخصية]؛ يكتب فيها الفنان أو المورد قصته، يرفع حتى (6 صور مميزة) بضغط تلقائي خفيف، ويعاين صفحته بعين (الفنانين / الموردين / العملاء).
   - 👨‍👩‍👧‍👦 مجتمع عيلة الشمساوية (طبلية العيلة والشات): من الشاشة الرئيسية أو القائمة الجانبية -> [عيلة الشمساوية]؛ يشارك الفنانون والموردون المنشورات والشات الحي، والضغط على صورة أي عضو يفتح صفحته الشخصية فوراً.
   - 🚚 منظومة الموردين B2B وسوق موردين الشمساوية:
     • للورش والفنانين: من شاشة [سوق موردين الشمساوية للخامات] يستعرضون الخامات المعتمدة، شرائح الكميات المتدرجة، تبويب [⚖️ مقارنة أسعار الموردين]، تقييمات الورش، وإرسال طلبية B2B تسمّع في المخزن والخزينة.
     • للموردين — منظومة الفروع الكاملة والـ POS والـ ERP (بدون صور في المخازن):
       1) [🌿 مركز قيادة الفروع والخزينة] (supplier_erp_hub): رسم شجرة الفروع والمخزن الرئيسي المركزي، متابعة حد الفروع المسموح (فرع واحد مجاني وتطلب فتح فرع إضافي أو أكثر بموافقة السوبر أدمن)، متابعة مؤشرات (معانا كام / لينا بره كام / علينا كام للمصانع / قيمة المخزون)، واستلام توريدات الفروع بزر [تأكيد استلام الفلوس] لنقل الحصيلة من خزينة الفرع إلى خزينة المالك.
       2) [🛒 كاشير نقاط البيع POS] (supplier_pos): بدون صور للسرعة، بحث لحظي بالاسم/الكود/القسم الرئيسي والفرعي، بيع بالوزن أو الكسور العشرية (مثل 2.4 كجم)، ربط العميل بالهاتف لمعرفة رصيده الآجل وعدد طلباته فرع vs أونلاين، اختيار [عميل فرع] أو [أونلاين] بالمصاريف والشحن، الدفع (كاش / إنستاباي / محفظة / آجل كامل أو جزئي)، فتح/تقفيل الوردية وتوريد الخزينة للمالك، و**طباعة إيصال حراري 80 ملم احترافي** باسم الفرع والشعار وتفاصيل الفاتورة.
       3) [🏭 المخازن وكارت الصنف والمصانع] (supplier_warehouse_erp): مخزون كل فرع بدون صور وبأكواد SKU تلقائية، معامل تحويل الوحدات (طرد ← كيلو/جرام)، **نظام التحويل المخزني بين الفروع بخطوتين (شحن ⇠ تأكيد استلام)** بحيث تبقى الكمية معلقة حتى يؤكد الفرع المستلم استلامها أو يرفضها فتعود للراسل تلقائياً مع توثيق في [كارت الصنف]، وشجرة الأقسام الرئيسية والفرعية، وقسم المصانع وفواتير الشراء لمعرفة "علينا كام للمصانع".
       4) [🖥️ شؤون العاملين وتثبيت الشاشات HR] (supplier_hr_terminal): بطاقة كل موظف (حضور وانصراف، جزاءات، حوافز، سلف، صافي الراتب)، إنشاء حساب دخول (Username + Password)، وتثبيت الشاشة على جهاز الفرع (Kiosk Lock) لقصر الجهاز على الكاشير أو المخزن أو المحاسب فقط مع فك التثبيت برقم المالك السري (PIN).
       5) البوابة التجارية للمورد: [📋 هلخصهالك للموردين]، [📦 كتالوج الخامات والمخزون] (بحد أقصى 3 صور مضغوطة)، [🧾 أوردراتي]، [👥 عملائي]، [💰 خزائن المورد]، و[🏪 متجر المورد العام وQR].
   - 🎨 لوحة السوبر أدمن — [هندسة الواجهات والقوائم] (ui_layout_studio): يملك المؤسس (البشمهندس حسام بسيوني) في لوحة السوبر أدمن استوديو سحب وإفلات كامل للتحكم في شاشات [بوابة الفنانين] و[بوابة الموردين] و[القائمة الجانبية والعلوية]؛ إنشاء بطاقات جديدة، نقل الأزرار بين البطاقات، تعديل الأسماء والأعمدة والأشكال، المعاينة الحية (موبايل وكمبيوتر مع زر رجوع لاستكمال التعديل)، والحفظ والنشر الفوري لجميع الحسابات.
   - 🧱 منظومة الخامات الموحدة الرباعية (Unified Materials System — 395+ خامة في 12 قسماً):
     • البنية الرباعية للكود: [قسم 2 حرف: TH, BD, CL, WD, LT, MT, DC, AR, PK, PP, GL, AX] ← [كود رئيسي: TH0001] ← [مواصفة/مقاس: TH0001.01] ← [ماركة للموردين: TH0001.01#B003]. مع جداول المسميات الدارجة (AL00001+) والماركات (B000..B053+) وسلاسل الوحدات (ل1..ل8) وحقول الجسر الهندسية (وزن_متر، طول_لفة، تغطية، رقم_تصبن...).
     • فك الالتباس الذكي: كلمة «خرز» تفرق بين الخيط المجدول (TH0001) وخرز الزينة (BD0001..)، والمنشأ مثل «دمياطي» هو خاصية للمواصفة وليس اسماً مرادفاً.
     • صلاحيات الفنان والمورد vs السوبر أدمن: يبحث الفنان أو المورد بالاسم أو الاختصار (مثل th أو wd) ويستورد ما يحتاجه فقط من زر [استيراد من منظومة الخامات الموحدة] ويصنف كل خامة عنده (أساسية أو فرعية). إذا لم يجد الخامة يضيفها فوراً فتأخذ كوداً جديداً وتصل للسوبر أدمن في شاشة [منظومة الخامات الموحدة] بشارة «جديد». أما إذا حذف أو عدّل عضو خامة فالتعديل/الحذف يسري على قائمته الخاصة فقط ولا يمس المنظومة العامة، مع إرسال إشعار مراجعة للسوبر أدمن ليقرر قبول التعميم أو الأرشفة (والأكواد المحذوفة لا يُعاد استخدامها أبداً).
   - 📦 الأرشيف والكتالوج والحاسبة: [أرشيف المنتجات] (بطاقات الصنف المحفوظة)، [منصتي والكتالوج] (التصدير للمتجر وسوق الشمساوية)، و[حاسبة التكاليف] (مع زر 🧮 [تصدير للحاسبة] في شات صقر).
   - 💰 المالية والأصول والحرفيين (للورش): [الخزينة والأرصدة والعهد]، [دفتر الحسابات والقيود]، [الأصول الثابتة]، [الموارد البشرية والعمالة]، و[التقارير المالية وقفل الشهر].

4. منظومة الورش الـ 14 والمعادلات الهندسية المصححة (50+ ورشة + دمج الحرف):
   - الأقسام الـ 14 في حاسبة التكاليف المحدثة:
     1) الحبال والنسيج والتطريز والملحقات: المكرمية، الكروشيه، الزجزاج (رامانوجان)، الكليم، البانش نيدل (قماش كانفاه مخرم / دك قطن / كتان — تم استبعاد مسمى الرهبان)، التافتنج، ★ العقدة (aqqada)، ★ الغزل اليدوي (spinning)، ★ التريكو (knitting)، ★ اللباد اليدوي (felting)، ★ الصباغة اليدوية (dyeing).
     2) الخرز والحلي والتطريز: شغل الخرز، التطريز اليدوي، ★ السيرما (sirma_embroidery)، الإكسسوارات والحلي، لف الأسلاك (wire_wrapping)، الترتر والفصوص.
     3) الخامات اللدنة والصب والشموع والصابون: الريزن إيبوكسي، UV ريزن، البوليستر (مع إخلاء مسؤولية التهوية)، الخرسانة الفنية (concrete)، الجبس (gypsum)، الجيسمونايت (jesmonite)، الصلصال الحراري (polymer_clay)، الفخار والخزف (pottery/ceramics)، الشموع، الصابون البارد (cold_process_soap مع تحذير الصودا الكاوية الحارق NaOH + معادلة رقم التصبن SAP والزيوت)، ★ صابون الجلسرين الذائب (melt_pour_soap)، ★ صناعة القوالب السيليكون (mold_making)، ★ جدول النسب المئوية العام (relative_recipes).
     4) الأخشاب والليزر والطباعة ثلاثية الأبعاد: الخيزران، الخوص والسلال، ★ الرتان (rattan)، الأركت (scroll_saw)، الأرابيسك، النجارة (nesting efficiency بدون هالك مزدوج)، الحرق على الخشب، الديكوباج، التطعيم بالخشب، ★ قص الليزر والراوتر CNC (laser_cnc بتكلفة دقيقة تشغيل الماكينة + كفاءة اللوح)، ★ الطباعة ثلاثية الأبعاد (3d_printing بكثافة 1.24 + نسبة الفشل + كهرباء الساعات).
     5) الجلود (leathercraft باستغلال ε ومقاييس المساطر ورفض الجلود المعيبة)، 6) المعادن واللحام والنحاس والفضة، 7) الديكور والإضاءة والزهور (★ تحذير أمان الكهربائي المؤهل واختبار العزل)، 8) الفنون والطباعة والخط والسابليميشن (sublimation)، 9) الورق والكروت وتجليد الكتب (bookbinding ★) والبابيه ماشيه، 10) تغليف العلب والشنط، 11) الخياطة والملابس والتنجيد، 12) خامات التشطيب المساعدة، 13) الفسيفساء والزجاج المعشق (mosaic_art و stained_glass ★)، 14) دمج الحِرف الشامل (craft_fusion بين أي ورشتين من أي قسم) ومحطة تشغيل الأفران والماكينات.
   - القواعد المحاسبية والهندسية المصححة (ث1–ث6) التي تستخدمها شموسة وتستدعي لها الأدوات (list_craft_equations و calculate_craft_estimate):
     • ث1 (توحيد الهالك على الصافي): دائماً الكمية الإجمالية = الصافي × (1 + ه)، وتحويل نسبة الفقد من الشراء تلقائياً بالمعادلة: هـ = ف / (1 − ف). ويُمنع منعاً باتاً ضرب هالك إضافي فوق معادلة كفاءة الاستغلال أو العائد (Y أو η).
     • ث2 (الزمن والمصنعية): ت_ص = (ن_تحضير + ن_تنفيذ + ن_تشطيب) × ق_س × م_ص + ر_خ، ووقت التجفيف/التخمير في الهواء لا يُحسب كأجر يد عاملة مدفوع ما لم يتدخل الصانع.
     • ث3/ث4 (الطاقة وإطفاء القوالب): ط = P_kW × ت_ط × سعر_ك.و.س + غاز، وتكلفة القالب للقطعة = ثمن القالب ÷ مرات الصب المتوقعة، وتظهر في لوحة Step 4.
     • ث5 (العائد الدفعي والفرز): م_سليم ≤ م، وتُوزع تكلفة الدفعة على عدد القطع السليمة فقط!
     • ث6 (المقارنة بين الهامش Margin والزيادة Markup): في وضع الهامش من سعر البيع: ث_ع = ت_ك ÷ (1 − ر − م_م)، وفي وضع الزيادة على التكلفة: ث_ع = ت_ك × (1 + ز_ي) ÷ (1 − م_م)، مع الإشارة للتعادل (مثلاً زيادة 50% على التكلفة = هامش 33.33% من البيع)، والتمييز عن الوضع المعزول القديم.
     • كل ورشة تملك ثوابت معايرة محلية (كثافة، انكماش، تغطية، أرقام تصبن) قابلة للتعديل والحفظ محلياً في المتصفح.
     • استخدمي أدوات [list_craft_equations] و [calculate_craft_estimate] دائماً عند سؤال العضو عن معادلة ورشة محددة أو تكلفة وتسعير عينة جديدة!

بيانات الحساب الحية والفعلية لحظة بلحظة (Live Ground Truth):
${isSupplierRole && supErp ? `1. ملخص فروع وخزائن المورد الحي (${workshopName}):
   - عدد الفروع النشطة: ${supErp.branchesCount} فرع.
   - معانا كام (الخزائن الكلية): ${metrics.liquidity.toLocaleString('ar-EG')} ج.م (خزينة المالك المعتمدة: ${supErp.ownerMainTreasury.toLocaleString('ar-EG')} ج.م | خزائن الفروع قبل التوريد: ${supErp.branchesTreasury.toLocaleString('ar-EG')} ج.م).
   - توريدات الفروع المعلقة بانتظار تأكيد الاستلام: ${supErp.pendingTransfersCount} توريد.
   - لينا بره كام (آجل العملاء المستحق): ${supErp.receivablesFromCustomers.toLocaleString('ar-EG')} ج.م.
   - علينا كام للمصانع والموردين: ${supErp.payablesToVendors.toLocaleString('ar-EG')} ج.م.
   - قيمة المخزون الحالية بالفروع: ${supErp.stockValuation.toLocaleString('ar-EG')} ج.م.
   - مبيعات كاشير POS اليوم: ${supErp.todayPosOrdersCount} فاتورة بإجمالي ${supErp.todayPosSales.toLocaleString('ar-EG')} ج.م.
   - تفاصيل الخزائن:
${metrics.treasuriesDesc || 'لا توجد تفاصيل إضافية مسجلة.'}` : `1. السيولة النقدية والخزائن:
   - إجمالي السيولة الفعلية المتوفرة حالياً: ${metrics.liquidity.toLocaleString('ar-EG')} ج.م.
   - تفاصيل الخزن والعهد المسجلة:
${metrics.treasuriesDesc || 'الخزينة النقدية الرئيسية متوفرة ومسجلة في دفاتر الورشة.'}`}

2. المخزون والنواقص:
   - الخامات / الأصناف الناقصة (تحت حد الأمان): ${metrics.lowMaterialsCount}.
${metrics.lowMaterialsDesc ? `   - تفاصيل النواقص:\n${metrics.lowMaterialsDesc}` : '   - كافة الأصناف حالياً فوق حد الأمان.'}

${!isSupplierRole ? `3. أوامر التشغيل وخط الإنتاج:
   - أوامر التشغيل المفتوحة وقيد التصنيع: ${metrics.openWorkOrdersCount} أمر تشغيل.
${metrics.openWorkOrdersDesc ? `   - تفاصيل أوامر التشغيل النشطة:\n${metrics.openWorkOrdersDesc}` : '   - لا توجد أوامر تشغيل مفتوحة حالياً.'}

4. المبيعات والطلبيات:
   - عدد الطلبيات المعلقة قيد التنفيذ: ${metrics.pendingOrdersCount} طلبية.` : ''}

${(() => {
  const eb = ctx.clientContext?.executiveBrief;
  if (!eb || isSupplierRole) return '';
  const debtorsLines = Array.isArray(eb.debtors) && eb.debtors.length > 0
    ? eb.debtors.slice(0, 6).map((d) =>
        `  • ليك عند ${d.name}: ${Number(d.totalOwed).toLocaleString('ar-EG')} ج.م${d.isOverdue ? ` (⚠️ متأخر بـ ${d.daysOverdue} يوم — انصحه بالمطالبة أو إرسال تذكير لطيف بالواتساب من هلخصهالك وعدم التعامل آجل معه مجدداً حتى يصفي القديم)` : ''}`
      ).join('\n')
    : '  • لا توجد ديون عند العملاء حالياً.';
  const creditorsLines = Array.isArray(eb.creditors) && eb.creditors.length > 0
    ? eb.creditors.slice(0, 6).map((c) => `  • علينا لـ ${c.name}: ${Number(c.totalOwed).toLocaleString('ar-EG')} ج.م`).join('\n')
    : '  • لا توجد مستحقات آجلة علينا للموردين حالياً.';
  const fastMats = Array.isArray(eb.fastMovingMaterials) && eb.fastMovingMaterials.length > 0
    ? eb.fastMovingMaterials.map((m) => `${m.name} (${m.consumedQty} ${m.unit})`).join('، ')
    : 'لم تُسجل حركات صرف بعد';
  const slowMats = Array.isArray(eb.slowMovingMaterials) && eb.slowMovingMaterials.length > 0
    ? eb.slowMovingMaterials.map((m) => `${m.name} (متبقي ${m.currentStock} ${m.unit})`).join('، ')
    : 'لا يوجد ركود واضح';
  const bestProds = Array.isArray(eb.bestSellingProducts) && eb.bestSellingProducts.length > 0
    ? eb.bestSellingProducts.map((p) => `${p.name} (مباع ${p.soldQty} قطعة)`).join('، ')
    : 'لم تُسجل مبيعات بعد';
  const slowProds = Array.isArray(eb.slowestProducts) && eb.slowestProducts.length > 0
    ? eb.slowestProducts.map((p) => `${p.name} (مباع ${p.soldQty})`).join('، ')
    : 'كل المنتجات تتحرك';
  return `5. ملخص (هلخصهالك) الحي لوضع الورشة (بدون مصطلحات دائن/مدين — تحدثي دائماً بلغة صاحب المنشأة المصرية السلسة):
   - توزيع السيولة: كاش ${Number(eb.cashTotal || 0).toLocaleString('ar-EG')} ج.م | إنستاباي وبنك ${Number(eb.instapayBankTotal || 0).toLocaleString('ar-EG')} ج.م | محافظ وعُهد ${Number(eb.walletsCustodyTotal || 0).toLocaleString('ar-EG')} ج.م.
   - لينا كام بره (${Number(eb.receivablesTotal || 0).toLocaleString('ar-EG')} ج.م):
${debtorsLines}
   - علينا كام للموردين (${Number(eb.payablesTotal || 0).toLocaleString('ar-EG')} ج.م):
${creditorsLines}
   - مخزن الخامات (${eb.materialsCount || 0} صنف بقيمة ${Number(eb.materialsTotalValue || 0).toLocaleString('ar-EG')} ج.م): الأكثر سحباً [${fastMats}] | قليل السحب [${slowMats}].
   - مخزن المنتجات (${eb.productsCount || 0} منتج بتكلفة ${Number(eb.productsCostValue || 0).toLocaleString('ar-EG')} وقيمة بيع ${Number(eb.productsRetailValue || 0).toLocaleString('ar-EG')} ج.م): الأكثر مبيعاً [${bestProds}] | الأقل حركة [${slowProds}].`;
})()}
${(() => {
  const parts: string[] = [];
  if (ctx.clientContext?.shamousaOrLearningContext) {
    parts.push(`\n6. ذاكرة التعلم المتبادل بين شموسة ومحرك بحوث العمليات (OR 360 Memory):\n${ctx.clientContext.shamousaOrLearningContext}`);
  }
  const ex = ctx.clientContext?.explainItemContext;
  if (ex && ex.title) {
    const stepsLine = Array.isArray(ex.actionSteps) && ex.actionSteps.length > 0
      ? `\n   - خطوات مقترحة من المحرك: ${ex.actionSteps.join(' | ')}`
      : '';
    parts.push(
      `\n7. طلب شرح فوري لبند من شاشة (${ex.section || 'لوحة شموسة'}) عبر زر علامة الاستفهام (؟):\n` +
      `   - العنوان: ${ex.title}\n` +
      (ex.metricBadge ? `   - المؤشر/الرقم: ${ex.metricBadge}\n` : '') +
      (ex.summary ? `   - التفاصيل: ${ex.summary}` : '') +
      stepsLine +
      `\n   - المطلوب منك الآن: اشرحي لـ ${firstName} البند ده ببساطة شديدة بالعامية المصرية الواضحة، وضّحي له "ده معناه إيه على شغله وأرباحه دلوقتي؟" وادّيه 2 إلى 3 خطوات عملية فورية ينفذها حالاً، مع ربط الشرح بأرقام ورشته الحية.`
    );
  }
  return parts.join('\n');
})()}

- عندما يسألك ${firstName} عن الملخص أو "هلخصهالك" (للورشة أو للمورد)، أو عن رصيد الخزنة، لينا بره كام، علينا كام، النواقص، إيه اللي شغال في المنتجات، الفروع، التحويلات بين الفروع، الفواتير الحرارية، هندسة الواجهات، أو المبيعات: أجيبي فوراً بالأرقام الحقيقية أعلاه بلغة بسيطة وودودة وخالية من تعقيدات الدائن والمدين، وأرشديه لبطاقة [هلخصهالك] لإرسال تذكير لطيف بالواتساب عند وجود متأخرات.
لديكِ أدوات استعلام فعلية معزولة تماماً (search_treasuries, search_materials, search_unified_materials, list_craft_equations, calculate_craft_estimate, search_orders, search_customers, search_suppliers, search_employees, workshop_overview) بالإضافة إلى محرك بحث جوجل الحي (googleSearch).`;
}

export async function handleShamousaChat(
  userMessage: string,
  history: any[],
  ctx: ShamousaContext,
  images?: Array<{ base64: string; mimeType?: string; name?: string }>
): Promise<{
  reply: string;
  handoffToFalcon?: boolean;
  provider: string;
  sources?: GroundedSource[];
  searchUsed?: boolean;
  searchEntryPoint?: string;
  inTrainingMode?: boolean;
}> {
  const userEmail = ctx.userEmail || '';
  const superAdmin = Boolean(ctx.isSuperAdmin || isSuperAdmin(userEmail));

  // 0. التحقق من حساب السوبر أدمن وبروتوكول التدريب والبرمجة التفاعلي (Session State)
  if (superAdmin) {
    const trainingResult = await processTrainingInteraction(
      'shamousa',
      userMessage,
      userEmail || 'hmb.top.tupe@gmail.com'
    );
    if (trainingResult.handled) {
      return {
        reply: trainingResult.reply,
        handoffToFalcon: false,
        provider: 'superadmin_engine',
        inTrainingMode: trainingResult.inTrainingMode,
      };
    }
  }

  const firstNameForGuard = extractFirstName(ctx.artistName) || (ctx.accountRole === 'supplier' ? 'أستاذ' : 'فنان');

  // 0.5 حارس الخصوصية الصارم على مستوى السيرفر (قبل أي استعلام أو نموذج) لغير السوبر أدمن
  if (!superAdmin) {
    const normCheck = String(userMessage || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىي]/g, 'ي');
    const isCrossTenantSnooping =
      /(فلان|فلانه|ورشه تاني|ورشه اخري|ورشه غيري|مورد تاني|مورد اخر|حساب تاني|بيانات ورشه|اسعار ورشه|مبيعات ورشه|ارباح ورشه|مين اكتر ورشه|اكتر ورشه بتبيع|بتشتري .* بكام|بيشتري .* بكام|عملاء ورشه|سعر شراء ورشه|اسرار المنظومه|مفاتيح الـ?api|api[_\s-]?key|vapid|service[_\s-]?role)/i.test(
        normCheck
      );
    if (isCrossTenantSnooping) {
      return {
        reply: `ده من بيانات ناس تانية يا ${firstNameForGuard}، وأنا ملتزمة أحافظ على خصوصية الكل زي ما بحافظ على خصوصيتك.\nأقدر أساعدك في بياناتك إنت، أو أقولك المعلومة العامة من منظومة الخامات الموحدة. تحب أي واحد؟`,
        handoffToFalcon: false,
        provider: 'privacy_guard',
      };
    }
  }

  // عزل السياق على مستوى السيرفر: غير السوبر أدمن محصور دائماً برقم ورشته الموثق فقط، والسوبر أدمن يحترم سياق الورشة المختارة إن وُجدت
  const effectiveWorkshopId = superAdmin
    ? (ctx.workshopId && ctx.workshopId !== 'ALL_WORKSHOPS' ? ctx.workshopId : 'ALL_WORKSHOPS')
    : ctx.workshopId;
  const toolCtx: WorkshopToolContext = {
    db: ctx.db,
    workshopId: effectiveWorkshopId,
    isSuperAdmin: superAdmin,
    accountRole: ctx.accountRole === 'supplier' ? 'supplier' : 'artisan',
    supplierId: ctx.supplierId || (ctx.accountRole === 'supplier' ? ctx.workshopId : undefined),
  };
  (toolCtx as any).clientContext = ctx.clientContext;

  // 1. استخراج سياق الحساب الحي الفعلي (Live Data Context)
  let liveLiquidity = Number(ctx.clientContext?.treasuryBalance ?? ctx.treasuryBalance ?? 0);
  let treasuriesDetailText = '';
  let supplierErpSummary: ShamousaLiveMetrics['supplierErpSummary'] = undefined;

  try {
    const treasuriesResult = await runWorkshopTool('search_treasuries', {}, toolCtx);
    if (typeof treasuriesResult.total_liquidity === 'number') {
      liveLiquidity = treasuriesResult.total_liquidity;
    }
    if (Array.isArray(treasuriesResult.treasuries) && treasuriesResult.treasuries.length > 0) {
      treasuriesDetailText = treasuriesResult.treasuries
        .map((t: any) => `- ${t.name} (${t.kind || 'خزينة'}): ${Number(t.balance).toLocaleString('ar-EG')} ج.م ${t.holder ? `[${t.holder}]` : ''}`)
        .join('\n');
    }
  } catch (err: any) {
    console.warn('[Shamousa Context] search_treasuries notice:', err?.message);
  }

  if (ctx.accountRole === 'supplier') {
    try {
      const ov = await runWorkshopTool('workshop_overview', {}, toolCtx);
      const clientOv = ctx.clientContext?.supplierErpOverview;
      const clientKpis = clientOv?.kpis || {};
      supplierErpSummary = {
        branchesCount: Number(ov.branches_count ?? clientOv?.branches?.length ?? 1),
        ownerMainTreasury: Number(ov.owner_main_treasury ?? clientKpis.ownerMainTreasuryTotal ?? 0),
        branchesTreasury: Number(ov.branches_treasury ?? clientKpis.branchesPendingTreasuryTotal ?? 0),
        pendingTransfersCount: Number(ov.pending_transfers_count ?? clientOv?.pendingTransfers?.length ?? 0),
        receivablesFromCustomers: Number(ov.receivables_from_customers ?? clientKpis.receivablesFromCustomers ?? 0),
        payablesToVendors: Number(ov.payables_to_vendors ?? clientKpis.payablesToVendors ?? 0),
        stockValuation: Number(ov.stock_valuation ?? clientKpis.totalStockValuation ?? 0),
        todayPosOrdersCount: Number(ov.today_pos_orders_count ?? clientKpis.todayPosOrdersCount ?? 0),
        todayPosSales: Number(ov.today_pos_sales ?? clientKpis.todayPosSales ?? 0),
      };
      if (liveLiquidity === 0 && clientKpis.totalCashOnHand) {
        liveLiquidity = Number(clientKpis.totalCashOnHand);
      }
    } catch {}
  }

  if (!treasuriesDetailText && Array.isArray(ctx.clientContext?.treasuriesDetail) && ctx.clientContext!.treasuriesDetail.length > 0) {
    treasuriesDetailText = ctx.clientContext!.treasuriesDetail
      .map((t: any) => `- ${t.name || 'خزينة'}: ${Number(t.balance || t.amount || 0).toLocaleString('ar-EG')} ج.م`)
      .join('\n');
  }

  // استخراج النواقص الحية
  const clientCtx: any = ctx.clientContext || {};
  let lowMaterialsCount = Number(clientCtx.lowMaterialsCount || 0);
  let lowMaterialsDesc = '';
  if (Array.isArray(clientCtx.lowMaterialsList) && clientCtx.lowMaterialsList.length > 0) {
    lowMaterialsDesc = clientCtx.lowMaterialsList.map((m: string) => `• ${m}`).join('\n');
  } else if (Array.isArray(clientCtx.materialsSummary)) {
    const low = clientCtx.materialsSummary.filter(
      (m: any) => (Number(m.currentStock) || 0) <= (Number(m.minAlertThreshold) || 5)
    );
    lowMaterialsCount = low.length;
    lowMaterialsDesc = low.map((m: any) => `• ${m.materialName}: المتبقي ${m.currentStock} ${m.unit || 'وحدة'} (حد الأمان: ${m.minAlertThreshold || 5})`).join('\n');
  }

  // استخراج أوامر التشغيل الحية
  let openWorkOrdersCount = Number(clientCtx.openWorkOrdersCount || 0);
  let openWorkOrdersDesc = '';
  if (Array.isArray(clientCtx.openWorkOrdersList) && clientCtx.openWorkOrdersList.length > 0) {
    openWorkOrdersDesc = clientCtx.openWorkOrdersList.map((w: string) => `• ${w}`).join('\n');
  }

  const pendingOrdersCount = Number(clientCtx.pendingOrdersCount || 0);

  const liveMetrics: ShamousaLiveMetrics = {
    liquidity: liveLiquidity,
    treasuriesDesc: treasuriesDetailText,
    lowMaterialsCount,
    lowMaterialsDesc,
    openWorkOrdersCount,
    openWorkOrdersDesc,
    pendingOrdersCount,
    supplierErpSummary,
  };

  const baseInstruction = buildShamousaSystemPrompt(ctx, liveMetrics);
  const memoryPrompt = await buildGlobalMemoryPrompt('shamousa');
  const systemInstruction = baseInstruction + (memoryPrompt ? `\n\n${memoryPrompt}` : '');

  const promptMessages: any[] = [
    { role: 'system', content: systemInstruction },
    ...history.slice(-8).map((m: any) => ({
      role: m.role === 'assistant' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.content || m.text || '',
    })),
    { role: 'user', content: userMessage },
  ];

  const groqKeys = getGroqApiKeys();
  const fanarKey = getFanarApiKey();
  let groqFailReason = '';
  let geminiFailReason = '';

  async function tryGroqExecution(key: string, msgsToSend: any[]): Promise<string | null> {
    let assistantMsg: any;
    try {
      assistantMsg = await callGroqChat(msgsToSend, workshopToolSchemas, key);
    } catch (err: any) {
      console.warn('[Shamousa Groq] Calling with tools encountered issue, falling back to direct chat:', err?.message);
      assistantMsg = await callGroqChat(msgsToSend, undefined, key);
    }

    if (assistantMsg?.tool_calls && Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
      const toolCall = assistantMsg.tool_calls[0];
      const fnName = toolCall.function?.name;
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
      } catch {}

      console.log(`[Shamousa Groq Tool Call]: ${fnName}`, fnArgs);
      const toolResult = await runWorkshopTool(fnName, fnArgs, toolCtx);

      const secondTurnMessages = [
        ...msgsToSend,
        assistantMsg,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          name: fnName,
          content: JSON.stringify(toolResult),
        },
      ];

      const secondTurnRes = await callGroqChat(secondTurnMessages, undefined, key);
      return secondTurnRes?.content?.trim() || null;
    }

    return assistantMsg?.content?.trim() || null;
  }

  const hasImages = Array.isArray(images) && images.length > 0;
  const wantsGoogleSearch = shouldTriggerGoogleSearch(userMessage, Boolean(ctx.useSearch));

  // -------------------------------------------------------------
  // Provider 1 (Primary): Google Gemini + Workshop Tools + Google Search Grounding
  // -------------------------------------------------------------
  let shamousaGeminiKey = resolveAgentGeminiKey('shamousa');
  for (let keyAttempt = 0; keyAttempt < 2; keyAttempt++) {
    if (!shamousaGeminiKey || isGeminiKeyCircuitOpen(shamousaGeminiKey)) break;
    console.log(`[AI Service: Shamousa] Attempting Provider 1 (Gemini key #${keyAttempt + 1} + Tools + Google Search)...`);
    try {
      const geminiResult = await callGeminiChatForShamousa(systemInstruction, promptMessages, toolCtx, {
        images,
        useSearch: wantsGoogleSearch,
      });
      if (geminiResult.reply) {
        console.log(
          '[AI Service: Shamousa] Provider 1 (Gemini) succeeded.',
          geminiResult.searchUsed ? `[Google Search Sources: ${geminiResult.sources.length}]` : ''
        );
        return {
          reply: geminiResult.reply,
          handoffToFalcon: false,
          provider: hasImages ? 'gemini_vision' : geminiResult.searchUsed ? 'gemini_google_search' : 'gemini',
          sources: geminiResult.sources,
          searchUsed: geminiResult.searchUsed,
          searchEntryPoint: geminiResult.searchEntryPoint,
        };
      }
      geminiFailReason = 'رد فارغ من Gemini';
      break;
    } catch (geminiErr: any) {
      geminiFailReason = geminiErr?.message || 'فشل الاتصال بـ Gemini';
      const nextKey = resolveAgentGeminiKey('shamousa');
      if (nextKey && nextKey !== shamousaGeminiKey && !isGeminiKeyCircuitOpen(nextKey)) {
        console.warn('[AI Service: Shamousa] Switching to next healthy Gemini key immediately...');
        shamousaGeminiKey = nextKey;
        continue;
      }
      console.warn(
        `[AI Service: Shamousa] Provider 1 (Gemini) failed: [${formatAiErrorReason(geminiFailReason)}] -> Switching to Provider 2 (Groq Backup)...`
      );
      break;
    }
  }
  if (!geminiFailReason) {
    geminiFailReason = shamousaGeminiKey
      ? 'مفتاح Gemini المجاني متجاوز مؤقتاً'
      : 'مفتاح Gemini المجاني (GEMINI_API_KEY_FALCON_CHAT) غير مضبوط في Secrets';
    console.log(`[AI Service: Shamousa] Provider 1 (Gemini) bypassed cleanly -> Routing directly to live Groq...`);
  }

  if (hasImages) {
    const firstName = extractFirstName(ctx.artistName) || 'صديقي';
    return {
      reply: superAdmin
        ? `يا ${firstName} ☀️ (تنبيه السوبر أدمن): تحليل الصور يعمل عبر مفتاحيك المجانيين (GEMINI_API_KEY_FALCON_VISION / GEMINI_API_KEY_FALCON_CHAT) في Settings > Secrets. المحادثة النصية والأدوات والبحث الحي تعمل حالياً.`
        : `حقك عليا يا ${firstName} ☀️، قراءة الصور فيها ضغط بسيط على الخط دلوقتي..\nبس ولا يهمك! اكتبلي اسم الخامة أو تفاصيل الفاتورة في سطرين وأنا أظبطلك كل حاجة في ثواني!`,
      handoffToFalcon: false,
      provider: 'system_notice',
      sources: [],
      searchUsed: false,
    };
  }

  // Enrich fallback models with real web search results if search was requested or triggered
  let fallbackSearchSources: GroundedSource[] = [];
  let fallbackSearchUsed = false;
  let fallbackMessages = promptMessages;

  if (!hasImages && wantsGoogleSearch) {
    try {
      const liveSearch = await performGoogleSearch(userMessage, {
        agent: 'shamousa',
        systemHint:
          'أنت باحث أسعار وموردين وخامات في السوق المصري لصالح منظومة الشمساوية. استخرج أحدث الأسعار والمصادر الحقيقية بإيجاز.',
      });
      if (liveSearch?.answer) {
        fallbackSearchUsed = true;
        fallbackSearchSources = liveSearch.sources || [];
        fallbackMessages = [
          ...promptMessages.slice(0, -1),
          {
            role: 'user',
            content: `${userMessage}\n\n[نتائج البحث الحي من الويب لاستخدامها في إجابتك]:\n${liveSearch.answer.slice(0, 1800)}`,
          },
        ];
      }
    } catch (searchErr: any) {
      console.warn('[AI Service: Shamousa] Fallback web search notice:', searchErr?.message);
    }
  }

  // -------------------------------------------------------------
  // Provider 2 (Backup): Groq API (Primary -> Secondary for fast text + tools)
  // -------------------------------------------------------------
  if (!hasImages && groqKeys.length > 0) {
    for (let i = 0; i < groqKeys.length; i++) {
      const key = groqKeys[i];
      console.log(`[AI Service: Shamousa] Attempting Provider 2 (Groq Backup key #${i + 1})...`);
      try {
        const reply = await tryGroqExecution(key, fallbackMessages);
        if (reply) {
          console.log(`[AI Service: Shamousa] Provider 2 (Groq Backup key #${i + 1}) succeeded.`);
          return {
            reply,
            handoffToFalcon: false,
            provider: fallbackSearchUsed ? 'groq_web_search' : 'groq',
            sources: fallbackSearchSources,
            searchUsed: fallbackSearchUsed,
          };
        }
        groqFailReason = 'رد فارغ من Groq';
      } catch (groqErr: any) {
        groqFailReason = groqErr?.message || 'Groq connection failed';
        console.error(`[AI Service: Shamousa] Groq key #${i + 1} failed: [${groqFailReason}]`);
      }
    }
  } else if (!hasImages) {
    groqFailReason = 'GROQ_API_KEY غير متوفر على الخادم';
  }

  // -------------------------------------------------------------
  // Provider 3 (Emergency Backup): Fanar Arabic LLM
  // -------------------------------------------------------------
  if (!hasImages && fanarKey) {
    console.log('[AI Service: Shamousa] Attempting Provider 3 (Fanar AI)...');
    try {
      const fanarReply = await callFanarChat(fallbackMessages, fanarKey);
      if (fanarReply) {
        console.log('[AI Service: Shamousa] Provider 3 (Fanar) succeeded.');
        return {
          reply: fanarReply,
          handoffToFalcon: false,
          provider: fallbackSearchUsed ? 'fanar_web_search' : 'fanar',
          sources: fallbackSearchSources,
          searchUsed: fallbackSearchUsed,
        };
      }
    } catch (fanarErr: any) {
      console.warn('[AI Service: Shamousa] Fanar failed:', fanarErr?.message);
    }
  }

  // -------------------------------------------------------------
  // الشفافية التقنية للسوبر أدمن فقط — رد دبلوماسي ذكي ولطيف لباقي الأعضاء
  // -------------------------------------------------------------
  const cleanGemini = formatAiErrorReason(geminiFailReason);
  const cleanGroq = formatAiErrorReason(groqFailReason);

  if (superAdmin) {
    throw new Error(
      `[تقرير السوبر أدمن] تعذر اتصال المحرك الخارجي: Gemini (${cleanGemini}) | Groq (${cleanGroq}). يرجى مراجعة المفاتيح المجانية في Settings > Secrets.`
    );
  }

  const friendlyName = extractFirstName(ctx.artistName) || (ctx.accountRole === 'supplier' ? 'أستاذ' : 'فنان');
  throw new Error(
    `حقك عليا يا ${friendlyName} ☀️، النت عندي بيقطع شوية من ضغط الشغل دلوقتي.. معلش ادّيني لحظة وحاول تاني، ولو عايز تسألني في أي حاجة تخص ورشتك أو الخامات الموحدة أنا جاهزة معاك فوراً!`
  );
}

// للتوافق مع أي استدعاء قديم
export const chatWithShamousa = handleShamousaChat;
export { isSuperAdmin };