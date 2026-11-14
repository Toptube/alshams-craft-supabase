import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Trash2,
  MessageSquare,
  ShieldAlert,
  Ban,
  UserCheck,
  Crown,
  Star,
  Link2,
  Check,
  Move,
  X,
  Lock,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  BarChart2,
  FileText,
  CheckCheck,
} from 'lucide-react';
import { UserProfile, isUserAdmin } from '../../types';
import { ArtisanAvatar } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

export type FamilyReactionType = 'like' | 'dislike' | 'love' | 'clap' | 'rose';

export interface FamilyPollOption {
  id: string;
  text: string;
  votesCount: number;
  votedByMe: boolean;
}

export interface FamilyCommentItem {
  id: string;
  postId: string;
  workshopId: string;
  authorEmail: string;
  isSuperAdmin: boolean;
  authorName: string;
  brandName: string;
  avatarUrl?: string | null;
  medal?: 'bronze' | 'silver' | 'gold' | 'diamond' | null;
  ratingStars?: number;
  content: string;
  createdAt: string;
}

export interface FamilyPostItem {
  id: string;
  workshopId: string;
  authorEmail: string;
  isSuperAdmin: boolean;
  authorName: string;
  brandName: string;
  avatarUrl?: string | null;
  medal?: 'bronze' | 'silver' | 'gold' | 'diamond' | null;
  ratingStars?: number;
  postType?: 'text' | 'poll';
  pollOptions?: FamilyPollOption[];
  totalVotes?: number;
  reactions?: Record<FamilyReactionType, number>;
  myReaction?: FamilyReactionType | null;
  content: string;
  createdAt: string;
  comments: FamilyCommentItem[];
}

export interface FamilyChatMessage {
  id: string;
  workshopId: string;
  authorEmail: string;
  isSuperAdmin: boolean;
  authorName: string;
  brandName: string;
  avatarUrl?: string | null;
  medal?: 'bronze' | 'silver' | 'gold' | 'diamond' | null;
  ratingStars?: number;
  content: string;
  createdAt: string;
}

export interface FamilyRestrictionRecord {
  workshopId: string;
  authorEmail: string;
  artistName?: string;
  brandName?: string;
  status: 'active' | 'restricted' | 'banned';
  reason?: string;
  updatedAt?: string;
}

export interface FamilyMemberEntry {
  workshopId: string;
  email: string;
  artistName: string;
  brandName: string;
  avatarUrl?: string | null;
  medal?: string | null;
  ratingStars?: number;
  restrictionStatus: 'active' | 'restricted' | 'banned';
  restrictionReason?: string;
}

interface FamilyCommunityViewProps {
  profile: UserProfile;
  isSwitchedWorkshop?: boolean;
}

const MEDAL_ICONS: Record<string, { emoji: string; title: string; className: string }> = {
  diamond: {
    emoji: '💎',
    title: 'القلادة الماسية',
    className: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-700',
  },
  gold: {
    emoji: '🥇',
    title: 'القلادة الذهبية',
    className: 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700',
  },
  silver: {
    emoji: '🥈',
    title: 'القلادة الفضية',
    className: 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600',
  },
  bronze: {
    emoji: '🥉',
    title: 'القلادة البرونزية',
    className: 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 dark:border-orange-700',
  },
};

const REACTION_CONFIG: Array<{
  type: FamilyReactionType;
  emoji: string;
  label: string;
}> = [
  { type: 'like', emoji: '👍', label: 'أعجبني' },
  { type: 'dislike', emoji: '👎', label: 'لم يعجبني' },
  { type: 'love', emoji: '❤️', label: 'أحببته' },
  { type: 'clap', emoji: '👏', label: 'عاش' },
  { type: 'rose', emoji: '🌹', label: 'تحية' },
];

function formatArabicDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

interface AuthorIdentityProps {
  authorName: string;
  brandName: string;
  avatarUrl?: string | null;
  isSuperAdmin: boolean;
  medal?: string | null;
  ratingStars?: number;
  createdAt?: string;
  compact?: boolean;
}

const FamilyAuthorIdentity: React.FC<AuthorIdentityProps> = ({
  authorName,
  brandName,
  avatarUrl,
  isSuperAdmin,
  medal,
  ratingStars = 5,
  createdAt,
  compact = false,
}) => {
  const medalInfo = medal ? MEDAL_ICONS[String(medal).toLowerCase()] : null;

  return (
    <div className="flex items-start gap-2.5 min-w-0">
      {isSuperAdmin ? (
        <div
          className={`${
            compact ? 'w-8 h-8' : 'w-10 h-10'
          } rounded-xl bg-gradient-to-br from-[#0C1427] via-[#1E3A8A] to-[#EA580C] text-[#FBBF24] border border-[#FBBF24]/70 flex items-center justify-center shrink-0 shadow-xs`}
        >
          <Crown className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </div>
      ) : avatarUrl ? (
        <img
          src={avatarUrl}
          alt={brandName || authorName}
          referrerPolicy="no-referrer"
          className={`${
            compact ? 'w-8 h-8' : 'w-10 h-10'
          } rounded-xl object-cover border border-[#EA580C]/45 bg-[#EFE9DC] dark:bg-[#132040] shrink-0`}
        />
      ) : (
        <ArtisanAvatar
          artistName={authorName}
          size={compact ? 'sm' : 'md'}
          className="shrink-0"
        />
      )}

      <div className="min-w-0 flex-1 text-right">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span
            className={`${
              compact ? 'text-xs' : 'text-sm'
            } font-black ${
              isSuperAdmin
                ? 'text-[#C2410C] dark:text-[#FBBF24]'
                : 'text-[#0C1427] dark:text-[#F7F3EA]'
            }`}
          >
            {isSuperAdmin ? 'كبير العيلة' : authorName}
          </span>

          {!isSuperAdmin && brandName && (
            <span
              className={`${
                compact ? 'text-[11px]' : 'text-xs'
              } font-bold text-[#475569] dark:text-[#CBD5E1]`}
            >
              ({brandName})
            </span>
          )}

          {isSuperAdmin ? (
            <span
              title="كبير العيلة — إدارة المنظومة"
              className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-[#0C1427] text-[#FBBF24] dark:bg-[#EA580C] dark:text-white text-[10px] font-black border border-[#FBBF24]/40"
            >
              <Crown className="w-3 h-3" />
            </span>
          ) : medalInfo ? (
            <span
              title={medalInfo.title}
              aria-label={medalInfo.title}
              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-xs leading-none border ${medalInfo.className}`}
            >
              {medalInfo.emoji}
            </span>
          ) : (
            <span
              title={`تقييم الورشة: ${ratingStars} نجوم`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[10px] font-black"
            >
              <span>{ratingStars}</span>
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            </span>
          )}
        </div>

        {createdAt && (
          <p className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            {formatArabicDateTime(createdAt)}
          </p>
        )}
      </div>
    </div>
  );
};

export const FamilyCommunityView: React.FC<FamilyCommunityViewProps> = ({
  profile,
  isSwitchedWorkshop = false,
}) => {
  const isAdmin = isUserAdmin(profile) && !isSwitchedWorkshop;
  const myWorkshopId = profile.workshopId || profile.tenantId || profile.id || '';
  const myEmail = (profile.email || '').toLowerCase();
  const myActorKey = myWorkshopId
    ? `w:${myWorkshopId.trim().toLowerCase()}`
    : `e:${myEmail}`;

  const authorProfilePayload = {
    workshopId: myWorkshopId,
    artistName: profile.artistName || '',
    brandName: profile.brandName || '',
    avatarUrl: (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64 || null,
    medal: (profile as any)?.medal || null,
    ratingStars: (profile as any)?.ratingStars || (profile as any)?.rating_stars || 5,
    isSwitchedWorkshop,
  };

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [myRestriction, setMyRestriction] = useState<FamilyRestrictionRecord | null>(null);

  const [posts, setPosts] = useState<FamilyPostItem[]>([]);
  const [chatMessages, setChatMessages] = useState<FamilyChatMessage[]>([]);
  const [members, setMembers] = useState<FamilyMemberEntry[]>([]);
  const [restrictions, setRestrictions] = useState<FamilyRestrictionRecord[]>([]);

  // Post composer (Regular Text Post vs Poll / Opinions & Voting)
  const [composerType, setComposerType] = useState<'text' | 'poll'>('text');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [pollOptionsInput, setPollOptionsInput] = useState<string[]>(['', '']);
  const [posting, setPosting] = useState<boolean>(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Comment drafts & expanded state
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [collapsedComments, setCollapsedComments] = useState<Record<string, boolean>>({});

  // Super Admin Moderation panel
  const [showModerationPanel, setShowModerationPanel] = useState<boolean>(false);
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  // Link copy feedback
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // WebSocket live status & chat widget
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [chatDraft, setChatDraft] = useState<string>('');
  const [chatSending, setChatSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isChatOpenRef = useRef<boolean>(isChatOpen);
  const chatReadStorageKey = `alshams_family_chat_last_read_${(myWorkshopId || myEmail || 'member').toLowerCase()}`;

  const getLastReadTimestamp = useCallback((): number => {
    try {
      const raw = localStorage.getItem(chatReadStorageKey);
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }, [chatReadStorageKey]);

  const handleMarkAllChatRead = useCallback(
    (playSound = true) => {
      if (playSound) playButtonClickSound();
      const latestMsgTime = chatMessages.reduce((maxTs, m) => {
        const ts = new Date(m.createdAt).getTime();
        return Number.isFinite(ts) && ts > maxTs ? ts : maxTs;
      }, 0);
      const nextTs = Math.max(Date.now(), latestMsgTime);
      try {
        localStorage.setItem(chatReadStorageKey, String(nextTs));
      } catch {}
      setUnreadChatCount(0);
    },
    [chatMessages, chatReadStorageKey]
  );

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 60);
    }
  }, [isChatOpen]);

  // Draggable Floating Chat Position (x, y from viewport top-left)
  const [chatPos, setChatPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 500 };
    return {
      x: 16,
      y: Math.max(80, window.innerHeight - 90),
    };
  });
  const dragStateRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ dragging: false, moved: false, startX: 0, startY: 0, origX: 16, origY: 500 });
  const suppressNextClickRef = useRef<boolean>(false);

  const clampPosition = useCallback((x: number, y: number, expanded: boolean) => {
    if (typeof window === 'undefined') return { x, y };
    const width = expanded ? Math.min(window.innerWidth * 0.92, 360) : 64;
    const height = expanded ? Math.min(window.innerHeight * 0.72, 430) : 68;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(76, window.innerHeight - height - 8);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(76, y), maxY),
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setChatPos((prev) => clampPosition(prev.x, prev.y, isChatOpen));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPosition, isChatOpen]);

  useEffect(() => {
    setChatPos((prev) => clampPosition(prev.x, prev.y, isChatOpen));
  }, [isChatOpen, clampPosition]);

  const handleDragPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('[data-no-drag="true"]')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    suppressNextClickRef.current = false;
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: chatPos.x,
      origY: chatPos.y,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = moveEvt.clientX - dragStateRef.current.startX;
      const dy = moveEvt.clientY - dragStateRef.current.startY;
      if (!dragStateRef.current.moved && Math.hypot(dx, dy) > 10) {
        dragStateRef.current.moved = true;
        suppressNextClickRef.current = true;
      }
      if (dragStateRef.current.moved) {
        const clamped = clampPosition(
          dragStateRef.current.origX + dx,
          dragStateRef.current.origY + dy,
          isChatOpenRef.current
        );
        setChatPos(clamped);
      }
    };

    const cleanup = () => {
      dragStateRef.current.dragging = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', cleanup);
    };

    const handlePointerUp = () => {
      const wasDrag = dragStateRef.current.moved;
      cleanup();
      if (wasDrag) {
        setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 120);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', cleanup);
  };

  const handleOpenChatFromButton = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    playButtonClickSound();
    setIsChatOpen(true);
  };

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authedFetch('/api/family/feed', {
        headers: myWorkshopId ? { 'x-workshop-id': myWorkshopId } : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'تعذر تحميل مجتمع عيلة الشمساوية');
      }
      setBlocked(Boolean(data.blocked));
      setMyRestriction(data.restriction || null);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      const loadedChat: FamilyChatMessage[] = Array.isArray(data.chatMessages) ? data.chatMessages : [];
      setChatMessages(loadedChat);
      const lastReadTs = getLastReadTimestamp();
      const unread = loadedChat.filter((m) => {
        const ts = new Date(m.createdAt).getTime();
        const isFromMe =
          (myEmail && m.authorEmail?.toLowerCase() === myEmail) ||
          (myWorkshopId && m.workshopId === myWorkshopId);
        return !isFromMe && Number.isFinite(ts) && ts > lastReadTs;
      }).length;
      setUnreadChatCount(unread);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setRestrictions(Array.isArray(data.restrictions) ? data.restrictions : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ في الاتصال بمجتمع العيلة.');
    } finally {
      setLoading(false);
    }
  }, [myWorkshopId, myEmail, getLastReadTimestamp]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Real-time WebSocket Connection (/ws/family)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByEffect = false;

    const connectWs = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || '';
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${wsProtocol}//${window.location.host}/ws/family?token=${encodeURIComponent(token)}&email=${encodeURIComponent(myEmail)}&workshopId=${encodeURIComponent(myWorkshopId)}`;

        ws = new WebSocket(url);
        ws.onopen = () => {
          if (!closedByEffect) setWsConnected(true);
        };
        ws.onclose = () => {
          if (closedByEffect) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 3500);
        };
        ws.onerror = () => {
          setWsConnected(false);
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'connected') {
              if (typeof msg.onlineCount === 'number') setOnlineCount(msg.onlineCount);
              return;
            }
            if (msg.type === 'post:created' && msg.payload) {
              setPosts((prev) => {
                if (prev.some((p) => p.id === msg.payload.id)) return prev;
                return [{ ...msg.payload, comments: msg.payload.comments || [] }, ...prev];
              });
            } else if (msg.type === 'post:deleted' && msg.payload?.id) {
              setPosts((prev) => prev.filter((p) => p.id !== msg.payload.id));
            } else if (msg.type === 'post:voted' && msg.payload?.postId) {
              const { postId, totalVotes, pollOptions, voterKey, selectedOptionId } = msg.payload;
              setPosts((prev) =>
                prev.map((p) => {
                  if (p.id !== postId) return p;
                  const isMe = voterKey === myActorKey;
                  const nextOptions = (pollOptions || []).map((opt: FamilyPollOption) => ({
                    ...opt,
                    votedByMe: isMe
                      ? opt.id === selectedOptionId
                      : Boolean(p.pollOptions?.find((x) => x.id === opt.id)?.votedByMe),
                  }));
                  return { ...p, totalVotes, pollOptions: nextOptions };
                })
              );
            } else if (msg.type === 'post:reacted' && msg.payload?.postId) {
              const { postId, reactions, reactorKey, myReaction } = msg.payload;
              setPosts((prev) =>
                prev.map((p) => {
                  if (p.id !== postId) return p;
                  const isMe = reactorKey === myActorKey;
                  return {
                    ...p,
                    reactions,
                    myReaction: isMe ? myReaction : p.myReaction ?? null,
                  };
                })
              );
            } else if (msg.type === 'comment:created' && msg.payload) {
              const pid = msg.payload.postId;
              setPosts((prev) =>
                prev.map((p) => {
                  if (p.id !== pid) return p;
                  if (p.comments.some((c) => c.id === msg.payload.id)) return p;
                  return { ...p, comments: [...p.comments, msg.payload] };
                })
              );
            } else if (msg.type === 'comment:deleted' && msg.payload?.id) {
              setPosts((prev) =>
                prev.map((p) => ({
                  ...p,
                  comments: p.comments.filter((c) => c.id !== msg.payload.id),
                }))
              );
            } else if (msg.type === 'chat:created' && msg.payload) {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === msg.payload.id)) return prev;
                return [...prev, msg.payload].slice(-120);
              });
              const isFromMe =
                (myEmail && String(msg.payload.authorEmail || '').toLowerCase() === myEmail) ||
                (myWorkshopId && String(msg.payload.workshopId || '') === myWorkshopId);
              if (!isFromMe) {
                setUnreadChatCount((n) => n + 1);
              }
              if (isChatOpenRef.current) {
                setTimeout(() => {
                  if (chatScrollRef.current) {
                    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                  }
                }, 40);
              }
            } else if (msg.type === 'chat:deleted' && msg.payload?.id) {
              setChatMessages((prev) => prev.filter((m) => m.id !== msg.payload.id));
            } else if (msg.type === 'member:moderated' && msg.payload) {
              const targetWid = String(msg.payload.workshopId || '').toLowerCase();
              const targetEmail = String(msg.payload.authorEmail || '').toLowerCase();
              if (
                (targetWid && targetWid === myWorkshopId.toLowerCase()) ||
                (targetEmail && targetEmail === myEmail)
              ) {
                fetchFeed();
              }
            }
          } catch {
            // ignore malformed frames
          }
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [myEmail, myWorkshopId, myActorKey, fetchFeed]);

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newPostContent.trim();
    if (!content) return;

    const cleanedOptions =
      composerType === 'poll'
        ? pollOptionsInput.map((o) => o.trim()).filter((o) => o.length > 0)
        : [];

    if (composerType === 'poll' && cleanedOptions.length < 2) {
      setPostError('يرجى كتابة اختيارين على الأقل للتصويت');
      return;
    }

    setPosting(true);
    setPostError(null);
    try {
      const res = await authedFetch('/api/family/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(myWorkshopId ? { 'x-workshop-id': myWorkshopId } : {}),
        },
        body: JSON.stringify({
          content,
          postType: composerType,
          pollOptions: cleanedOptions,
          authorProfile: authorProfilePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.restriction) setMyRestriction(data.restriction);
        throw new Error(data?.error || 'تعذر نشر المنشور');
      }
      playSuccessSound();
      setNewPostContent('');
      setPollOptionsInput(['', '']);
      setComposerType('text');
      if (data.post) {
        setPosts((prev) => (prev.some((p) => p.id === data.post.id) ? prev : [data.post, ...prev]));
      }
    } catch (err: any) {
      setPostError(err?.message || 'حدث خطأ أثناء النشر');
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (postId: string, optionId: string) => {
    if (isRestricted) return;
    playButtonClickSound();
    try {
      const res = await authedFetch(`/api/family/posts/${encodeURIComponent(postId)}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(myWorkshopId ? { 'x-workshop-id': myWorkshopId } : {}),
        },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (res.ok && data.pollOptions) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, pollOptions: data.pollOptions, totalVotes: data.totalVotes }
              : p
          )
        );
      }
    } catch {}
  };

  const handleReact = async (postId: string, reactionType: FamilyReactionType) => {
    if (isRestricted) return;
    playButtonClickSound();
    try {
      const res = await authedFetch(`/api/family/posts/${encodeURIComponent(postId)}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(myWorkshopId ? { 'x-workshop-id': myWorkshopId } : {}),
        },
        body: JSON.stringify({ reactionType }),
      });
      const data = await res.json();
      if (res.ok && data.reactions) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, reactions: data.reactions, myReaction: data.myReaction }
              : p
          )
        );
      }
    } catch {}
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const res = await authedFetch(`/api/family/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: myWorkshopId ? { 'x-workshop-id': myWorkshopId } : undefined,
      });
      if (res.ok) {
        playButtonClickSound();
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {}
  };

  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const content = (commentDrafts[postId] || '').trim();
    if (!content) return;
    setCommentSubmitting((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await authedFetch(`/api/family/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(myWorkshopId ? { 'x-workshop-id': myWorkshopId } : {}),
        },
        body: JSON.stringify({
          content,
          authorProfile: authorProfilePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.restriction) setMyRestriction(data.restriction);
        throw new Error(data?.error || 'تعذر إرسال التعليق');
      }
      playButtonClickSound();
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      if (data.comment) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            if (p.comments.some((c) => c.id === data.comment.id)) return p;
            return { ...p, comments: [...p.comments, data.comment] };
          })
        );
      }
    } catch (err: any) {
      setPostError(err?.message || 'تعذر إرسال التعليق');
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    try {
      const res = await authedFetch(`/api/family/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: myWorkshopId ? { 'x-workshop-id': myWorkshopId } : undefined,
      });
      if (res.ok) {
        playButtonClickSound();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
              : p
          )
        );
      }
    } catch {}
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = chatDraft.trim();
    if (!content) return;
    setChatSending(true);
    setChatError(null);
    try {
      const res = await authedFetch('/api/family/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(myWorkshopId ? { 'x-workshop-id': myWorkshopId } : {}),
        },
        body: JSON.stringify({
          content,
          authorProfile: authorProfilePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.restriction) setMyRestriction(data.restriction);
        throw new Error(data?.error || 'تعذر إرسال الرسالة');
      }
      playButtonClickSound();
      setChatDraft('');
      if (data.message) {
        setChatMessages((prev) =>
          prev.some((m) => m.id === data.message.id)
            ? prev
            : [...prev, data.message].slice(-120)
        );
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 40);
      }
    } catch (err: any) {
      setChatError(err?.message || 'حدث خطأ في الشات');
    } finally {
      setChatSending(false);
    }
  };

  const handleDeleteChat = async (msgId: string) => {
    try {
      const res = await authedFetch(`/api/family/chat/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
        headers: myWorkshopId ? { 'x-workshop-id': myWorkshopId } : undefined,
      });
      if (res.ok) {
        playButtonClickSound();
        setChatMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch {}
  };

  const handleModerateMember = async (
    target: { workshopId?: string; authorEmail?: string; artistName?: string; brandName?: string },
    status: 'restricted' | 'banned' | 'active'
  ) => {
    const key = target.workshopId || target.authorEmail || '';
    setModeratingId(key);
    try {
      const reason =
        status === 'banned'
          ? 'حظر من مجتمع عيلة الشمساوية بقرار من كبير العيلة'
          : status === 'restricted'
          ? 'تقييد مؤقت من النشر والتعليق والشات بقرار من كبير العيلة'
          : '';
      const res = await authedFetch('/api/family/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId: target.workshopId,
          authorEmail: target.authorEmail,
          artistName: target.artistName,
          brandName: target.brandName,
          status,
          reason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        playSuccessSound();
        setRestrictions(Array.isArray(data.restrictions) ? data.restrictions : []);
        setMembers((prev) =>
          prev.map((m) =>
            (target.workshopId && m.workshopId === target.workshopId) ||
            (target.authorEmail && m.email === target.authorEmail)
              ? { ...m, restrictionStatus: status, restrictionReason: reason }
              : m
          )
        );
      }
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };

  const handleCopyFamilyLink = () => {
    const shareUrl = `${window.location.origin}/#/family`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    playButtonClickSound();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const isRestricted = Boolean(!isAdmin && myRestriction?.status === 'restricted');

  if (blocked && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center" dir="rtl">
        <div className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-rose-300 dark:border-rose-800 p-8 shadow-md">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
            <Ban className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] mb-2">
            تم حظر دخولك إلى مجتمع عيلة الشمساوية
          </h2>
          <p className="text-sm font-bold text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            {myRestriction?.reason || 'تم تعليق صلاحية الوصول إلى صفحة العيلة بقرار إداري من كبير العيلة.'}
          </p>
        </div>
      </div>
    );
  }

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.artistName.toLowerCase().includes(q) ||
      m.brandName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4" dir="rtl">
      {/* Single-Line Compact Header (لا يتعدى سطراً واحداً على الموبايل) */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] px-3 py-2.5 sm:px-4 sm:py-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-nowrap">
          <h1 className="text-[11px] sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate whitespace-nowrap min-w-0">
            منور طبلية عيلة الشمساويه يافنان 🌹 اتفضل
          </h1>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyFamilyLink}
              title={copiedLink ? 'تم نسخ رابط العيلة' : 'نسخ رابط مجتمع العيلة'}
              aria-label="نسخ رابط مجتمع العيلة"
              className="w-8 h-8 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:border-[#EA580C] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
              )}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  setShowModerationPanel((prev) => !prev);
                }}
                title="إدارة وتقييد الأعضاء"
                className={`h-8 px-2.5 rounded-xl border text-[11px] font-black flex items-center gap-1 cursor-pointer transition active:scale-95 whitespace-nowrap shrink-0 ${
                  showModerationPanel
                    ? 'bg-[#EA580C] text-white border-[#C2410C]'
                    : 'bg-[#0C1427] text-[#FBBF24] border-[#22355E] hover:border-[#EA580C]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>({restrictions.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Super Admin Moderation Drawer */}
        {isAdmin && showModerationPanel && (
          <div className="mt-3 pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                إدارة أعضاء العيلة (تقييد / حظر)
              </span>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="ابحث باسم الفنان أو الورشة..."
                  className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>

            {filteredMembers.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-2">
                لا يوجد أعضاء مطابقون لنتائج البحث.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-[#D4CCBC]/70 dark:divide-[#22355E] rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/60 dark:bg-[#060B18]/70">
                {filteredMembers.map((m) => (
                  <div
                    key={m.workshopId}
                    className="p-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <FamilyAuthorIdentity
                      authorName={m.artistName}
                      brandName={m.brandName}
                      avatarUrl={m.avatarUrl}
                      isSuperAdmin={false}
                      medal={m.medal}
                      ratingStars={m.ratingStars}
                      compact
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.restrictionStatus !== 'active' && (
                        <button
                          type="button"
                          disabled={moderatingId === m.workshopId}
                          onClick={() =>
                            handleModerateMember(
                              {
                                workshopId: m.workshopId,
                                authorEmail: m.email,
                                artistName: m.artistName,
                                brandName: m.brandName,
                              },
                              'active'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>فك {m.restrictionStatus === 'banned' ? 'الحظر' : 'التقييد'}</span>
                        </button>
                      )}

                      {m.restrictionStatus !== 'restricted' && (
                        <button
                          type="button"
                          disabled={moderatingId === m.workshopId}
                          onClick={() =>
                            handleModerateMember(
                              {
                                workshopId: m.workshopId,
                                authorEmail: m.email,
                                artistName: m.artistName,
                                brandName: m.brandName,
                              },
                              'restricted'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <Lock className="w-3 h-3" />
                          <span>تقييد</span>
                        </button>
                      )}

                      {m.restrictionStatus !== 'banned' && (
                        <button
                          type="button"
                          disabled={moderatingId === m.workshopId}
                          onClick={() =>
                            handleModerateMember(
                              {
                                workshopId: m.workshopId,
                                authorEmail: m.email,
                                artistName: m.artistName,
                                brandName: m.brandName,
                              },
                              'banned'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <Ban className="w-3 h-3" />
                          <span>حظر</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Post Composer: Text Post OR Opinions & Poll */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-5 shadow-xs">
        {isRestricted ? (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-4 flex items-center gap-3 text-amber-900 dark:text-amber-200">
            <Lock className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-xs sm:text-sm font-bold">
              حسابك مقيد مؤقتاً من المشاركة (النشر والتعليق والشات المباشر) بقرار من كبير العيلة. يمكنك قراءة منشورات العيلة فقط.
            </div>
          </div>
        ) : (
          <form onSubmit={handlePublishPost} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FamilyAuthorIdentity
                authorName={isAdmin ? 'كبير العيلة' : (profile.artistName || 'فنان الشمساوية')}
                brandName={isAdmin ? '' : (profile.brandName || 'ورشة الشمساوية')}
                avatarUrl={
                  (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64 || null
                }
                isSuperAdmin={isAdmin}
                medal={(profile as any)?.medal || null}
                ratingStars={(profile as any)?.ratingStars || (profile as any)?.rating_stars || 5}
                compact
              />

              {/* اختيار نوع المشاركة: مشاركة منشور أو آراء وتصويت */}
              <div className="inline-flex items-center p-1 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setComposerType('text');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition ${
                    composerType === 'text'
                      ? 'bg-[#EA580C] text-white shadow-xs'
                      : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>مشاركة منشور</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setComposerType('poll');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition ${
                    composerType === 'poll'
                      ? 'bg-[#EA580C] text-white shadow-xs'
                      : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54]'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>آراء وتصويت</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              maxLength={2000}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={
                composerType === 'poll'
                  ? 'اكتب سؤالك أو موضوع التصويت لعيلة الشمساوية...'
                  : 'شارك كلامك أو رأيك أو خبرتك مع عيلة الشمساوية...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-sm text-[#0C1427] dark:text-[#F7F3EA] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] focus:outline-none focus:border-[#EA580C] resize-y leading-relaxed"
            />

            {/* اختيارات التصويت عند اختيار آراء وتصويت */}
            {composerType === 'poll' && (
              <div className="rounded-xl bg-[#EFE9DC]/85 dark:bg-[#060B18]/80 border border-[#D4CCBC] dark:border-[#22355E] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                    اختيارات التصويت
                  </span>
                  {pollOptionsInput.length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        setPollOptionsInput((prev) => [...prev, '']);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0C1427] dark:bg-[#132040] text-[#FBBF24] border border-[#22355E] text-[11px] font-black cursor-pointer hover:border-[#EA580C] transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>إضافة اختيار</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {pollOptionsInput.map((optVal, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#FBBF24] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-mono font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        maxLength={120}
                        value={optVal}
                        onChange={(e) =>
                          setPollOptionsInput((prev) =>
                            prev.map((v, i) => (i === idx ? e.target.value : v))
                          )
                        }
                        placeholder={`الاختيار رقم ${idx + 1}`}
                        className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                      />
                      {pollOptionsInput.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            playButtonClickSound();
                            setPollOptionsInput((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          title="حذف الاختيار"
                          className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {postError && (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{postError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                {newPostContent.length} / 2000
              </span>

              <button
                type="submit"
                disabled={posting || !newPostContent.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-b from-[#EA580C] to-[#C2410C] hover:from-[#F97316] hover:to-[#EA580C] disabled:opacity-50 text-white text-xs sm:text-sm font-black shadow-[0_3px_0_0_#9A3412] active:translate-y-0.5 active:shadow-none cursor-pointer transition"
              >
                <Send className="w-4 h-4" />
                <span>{posting ? 'جاري النشر...' : composerType === 'poll' ? 'نشر التصويت' : 'نشر'}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Feed List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
            جاري التحميل...
          </p>
        </div>
      ) : errorMsg ? (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-5 text-center space-y-2">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{errorMsg}</p>
          <button
            type="button"
            onClick={fetchFeed}
            className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center space-y-2">
          <MessageSquare className="w-9 h-9 mx-auto text-[#EA580C]" />
          <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            لا توجد مشاركات بعد — ابدأ أول منشور أو تصويت الآن!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const canDeletePost =
              isAdmin ||
              (myWorkshopId && post.workshopId === myWorkshopId) ||
              (myEmail && post.authorEmail.toLowerCase() === myEmail);
            const isCommentsCollapsed = Boolean(collapsedComments[post.id]);
            const isPoll = post.postType === 'poll' && Array.isArray(post.pollOptions) && post.pollOptions.length >= 2;
            const totalVotes = Number(post.totalVotes || 0);
            const reactions: Record<FamilyReactionType, number> = {
              like: 0,
              dislike: 0,
              love: 0,
              clap: 0,
              rose: 0,
              ...(post.reactions || {}),
            };
            const activeReactionItems = REACTION_CONFIG.filter((rx) => (reactions[rx.type] || 0) > 0);
            const totalReactionsCount = activeReactionItems.reduce(
              (sum, rx) => sum + (reactions[rx.type] || 0),
              0
            );

            return (
              <article
                key={post.id}
                className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-colors ${
                  post.isSuperAdmin
                    ? 'bg-[#FDFBF5] dark:bg-[#101C3A] border-[#EA580C]/50 dark:border-[#FBBF24]/50'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                {/* Author Header & Moderation Controls */}
                <div className="flex items-start justify-between gap-3">
                  <FamilyAuthorIdentity
                    authorName={post.authorName}
                    brandName={post.brandName}
                    avatarUrl={post.avatarUrl}
                    isSuperAdmin={post.isSuperAdmin}
                    medal={post.medal}
                    ratingStars={post.ratingStars}
                    createdAt={post.createdAt}
                  />

                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && !post.isSuperAdmin && (
                      <>
                        <button
                          type="button"
                          title="تقييد العضو من المشاركة"
                          onClick={() =>
                            handleModerateMember(
                              {
                                workshopId: post.workshopId,
                                authorEmail: post.authorEmail,
                                artistName: post.authorName,
                                brandName: post.brandName,
                              },
                              'restricted'
                            )
                          }
                          className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] hover:bg-amber-600 hover:text-white text-amber-700 dark:text-amber-300 border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer transition"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="حظر العضو من العيلة"
                          onClick={() =>
                            handleModerateMember(
                              {
                                workshopId: post.workshopId,
                                authorEmail: post.authorEmail,
                                artistName: post.authorName,
                                brandName: post.brandName,
                              },
                              'banned'
                            )
                          }
                          className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer transition"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {canDeletePost && (
                      <button
                        type="button"
                        title="حذف المنشور"
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Text-only Post Body */}
                <p className="mt-3 text-sm sm:text-[15px] font-medium text-[#0C1427] dark:text-[#F7F3EA] whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>

                {/* Interactive Poll Options (when postType === 'poll') */}
                {isPoll && (
                  <div className="mt-3.5 space-y-2">
                    {post.pollOptions!.map((opt) => {
                      const pct =
                        totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isRestricted}
                          onClick={() => handleVote(post.id, opt.id)}
                          className={`relative w-full overflow-hidden rounded-xl border p-2.5 sm:p-3 text-right transition cursor-pointer disabled:cursor-not-allowed ${
                            opt.votedByMe
                              ? 'border-[#EA580C] bg-[#FFF7ED] dark:bg-[#1A2B54]'
                              : 'border-[#D4CCBC] dark:border-[#22355E] bg-white/80 dark:bg-[#060B18]/80 hover:border-[#EA580C]/70'
                          }`}
                        >
                          <div
                            className="absolute inset-y-0 right-0 bg-[#EA580C]/15 dark:bg-[#EA580C]/25 transition-all duration-300 pointer-events-none"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                  opt.votedByMe
                                    ? 'bg-[#EA580C] border-[#EA580C] text-white'
                                    : 'border-[#94A3B8] dark:border-[#475569] bg-transparent'
                                }`}
                              >
                                {opt.votedByMe && <Check className="w-3 h-3" />}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] truncate">
                                {opt.text}
                              </span>
                            </div>

                            <span className="text-xs font-mono font-black text-[#C2410C] dark:text-[#FBBF24] shrink-0 whitespace-nowrap">
                              {opt.votesCount} صوت
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      إجمالي الأصوات: {totalVotes}
                    </p>
                  </div>
                )}

                {/* Facebook-Style Reactions Summary Bar */}
                {(totalReactionsCount > 0 || post.comments.length > 0) && (
                  <div className="mt-3.5 pt-2.5 border-t border-[#D4CCBC]/60 dark:border-[#22355E]/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {totalReactionsCount > 0 && (
                        <>
                          <div className="flex items-center -space-x-1 space-x-reverse">
                            {activeReactionItems.map((rx) => (
                              <span
                                key={rx.type}
                                title={`${rx.label}: ${reactions[rx.type]}`}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs leading-none shadow-2xs"
                              >
                                {rx.emoji}
                              </span>
                            ))}
                          </div>
                          <span className="font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {totalReactionsCount}
                          </span>
                          <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                            ({activeReactionItems.map((rx) => `${rx.label} ${reactions[rx.type]}`).join(' · ')})
                          </span>
                        </>
                      )}
                    </div>

                    {post.comments.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                        className="text-[11px] font-bold hover:text-[#EA580C] dark:hover:text-[#FBBF24] cursor-pointer"
                      >
                        {post.comments.length} تعليق
                      </button>
                    )}
                  </div>
                )}

                {/* Standard Group Reactions (incl. Like & Dislike) + Comments Toggle Bar */}
                <div className="mt-2.5 pt-2.5 border-t border-[#D4CCBC]/80 dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {REACTION_CONFIG.map((rx) => {
                      const count = reactions[rx.type] || 0;
                      const isActive = post.myReaction === rx.type;

                      return (
                        <button
                          key={rx.type}
                          type="button"
                          disabled={isRestricted}
                          onClick={() => handleReact(post.id, rx.type)}
                          title={rx.label}
                          aria-label={rx.label}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold cursor-pointer transition active:scale-95 disabled:opacity-60 ${
                            isActive
                              ? rx.type === 'dislike'
                                ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] shadow-xs dark:bg-[#1A2B54]'
                                : 'bg-[#EA580C] text-white border-[#C2410C] shadow-xs'
                              : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                          }`}
                        >
                          <span className="text-sm leading-none">{rx.emoji}</span>
                          {(rx.type === 'like' || rx.type === 'dislike') && (
                            <span className="text-[11px] font-bold hidden sm:inline">{rx.label}</span>
                          )}
                          {count > 0 && (
                            <span className="font-mono text-[11px] font-black">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#475569] dark:text-[#CBD5E1] hover:text-[#EA580C] dark:hover:text-[#FBBF24] cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>التعليقات ({post.comments.length})</span>
                    {isCommentsCollapsed ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Comments Thread */}
                {!isCommentsCollapsed && (
                  <div className="mt-3 space-y-2.5">
                    {post.comments.map((comment) => {
                      const canDeleteComment =
                        isAdmin ||
                        (myWorkshopId && comment.workshopId === myWorkshopId) ||
                        (myEmail && comment.authorEmail.toLowerCase() === myEmail);

                      return (
                        <div
                          key={comment.id}
                          className="rounded-xl bg-[#EFE9DC]/85 dark:bg-[#060B18]/80 border border-[#D4CCBC]/80 dark:border-[#22355E] p-3 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <FamilyAuthorIdentity
                              authorName={comment.authorName}
                              brandName={comment.brandName}
                              avatarUrl={comment.avatarUrl}
                              isSuperAdmin={comment.isSuperAdmin}
                              medal={comment.medal}
                              ratingStars={comment.ratingStars}
                              createdAt={comment.createdAt}
                              compact
                            />

                            <div className="flex items-center gap-1 shrink-0">
                              {isAdmin && !comment.isSuperAdmin && (
                                <button
                                  type="button"
                                  title="تقييد العضو"
                                  onClick={() =>
                                    handleModerateMember(
                                      {
                                        workshopId: comment.workshopId,
                                        authorEmail: comment.authorEmail,
                                        artistName: comment.authorName,
                                        brandName: comment.brandName,
                                      },
                                      'restricted'
                                    )
                                  }
                                  className="p-1 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white cursor-pointer transition"
                                >
                                  <Lock className="w-3 h-3" />
                                </button>
                              )}
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  title="حذف التعليق"
                                  onClick={() => handleDeleteComment(comment.id, post.id)}
                                  className="p-1 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer transition"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs sm:text-[13px] text-[#0C1427] dark:text-[#F7F3EA] whitespace-pre-wrap leading-relaxed pr-10">
                            {comment.content}
                          </p>
                        </div>
                      );
                    })}

                    {/* Add Text Comment Input */}
                    {!isRestricted && (
                      <form
                        onSubmit={(e) => handleAddComment(e, post.id)}
                        className="flex items-center gap-2 pt-1"
                      >
                        <input
                          type="text"
                          maxLength={1000}
                          value={commentDrafts[post.id] || ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder={
                            isAdmin ? 'رد بصفتك كبير العيلة...' : 'اكتب تعليقاً نصياً...'
                          }
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                        />
                        <button
                          type="submit"
                          disabled={
                            Boolean(commentSubmitting[post.id]) ||
                            !(commentDrafts[post.id] || '').trim()
                          }
                          aria-label="إرسال التعليق"
                          className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>تعليق</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Draggable Floating Group Live Chat Widget */}
      <div
        style={{
          position: 'fixed',
          left: `${chatPos.x}px`,
          top: `${chatPos.y}px`,
          zIndex: 45,
        }}
        dir="rtl"
      >
        {!isChatOpen ? (
          <div className="relative flex flex-col items-center gap-1">
            {unreadChatCount > 0 && (
              <span
                title={`${unreadChatCount} رسائل غير مقروءة`}
                className="pointer-events-none absolute -top-2.5 -right-2 z-10 min-w-[20px] h-5 px-1.5 rounded-full bg-[#EA580C] text-white border-2 border-[#0C1427] dark:border-[#F7F3EA] text-[10px] font-mono font-black flex items-center justify-center shadow-md"
              >
                {unreadChatCount > 99 ? '+99' : unreadChatCount}
              </span>
            )}

            <button
              type="button"
              onPointerDown={handleDragPointerDown}
              onClick={handleOpenChatFromButton}
              title="شات العيلة — اضغط من أي مكان للفتح أو اسحب للتحريك"
              aria-label="شات العيلة المباشر"
              className="touch-none select-none cursor-pointer relative w-12 h-12 rounded-2xl bg-gradient-to-b from-[#1E3A8A] to-[#0C1427] text-[#FB923C] border-2 border-[#EA580C] shadow-[0_6px_18px_rgba(12,20,39,0.45)] flex items-center justify-center hover:brightness-110 transition-transform active:scale-95"
            >
              <MessageSquare className="w-6 h-6 text-[#FB923C] fill-[#EA580C]/25 drop-shadow-xs pointer-events-none" />
              <span
                className={`pointer-events-none absolute bottom-1 left-1 w-2 h-2 rounded-full border border-[#0C1427] ${
                  wsConnected ? 'bg-emerald-400' : 'bg-amber-300'
                }`}
                title={wsConnected ? 'متصل الآن' : 'جاري الاتصال'}
              />
            </button>

            {unreadChatCount > 0 && (
              <button
                type="button"
                data-no-drag="true"
                onClick={() => handleMarkAllChatRead(true)}
                title="تحديد كل رسائل الشات كمقروءة لإخفاء العداد"
                className="px-2 py-0.5 rounded-lg bg-[#0C1427] hover:bg-[#1E3A8A] text-[#F7F3EA] border border-[#EA580C]/70 text-[10px] font-black flex items-center gap-1 shadow-md cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <CheckCheck className="w-3 h-3 text-[#FB923C]" />
                <span>تم قراءة الكل</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-[min(92vw,360px)] rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/70 dark:border-[#FBBF24]/60 shadow-2xl overflow-hidden flex flex-col">
            {/* Draggable Header */}
            <div
              onPointerDown={handleDragPointerDown}
              title="اسحب لتحريك نافذة الشات في أي اتجاه"
              className="touch-none select-none cursor-grab active:cursor-grabbing px-3.5 py-2.5 bg-[#0C1427] dark:bg-[#132040] text-[#F7F3EA] flex items-center justify-between gap-2 border-b border-[#22355E]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Move className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black truncate">شات العيلة المباشر</span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        wsConnected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-[#CBD5E1] font-semibold">
                    {wsConnected ? `متصلون الآن (${onlineCount})` : 'جاري الاتصال...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0" data-no-drag="true">
                <button
                  type="button"
                  onClick={() => handleMarkAllChatRead(true)}
                  disabled={unreadChatCount === 0}
                  title="تم قراءة الكل"
                  className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition ${
                    unreadChatCount > 0
                      ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-xs active:scale-95'
                      : 'bg-[#1A2B54] text-emerald-300 opacity-80 cursor-default'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تم قراءة الكل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  aria-label="تصغير شات العيلة"
                  className="w-7 h-7 rounded-lg bg-[#1A2B54] hover:bg-[#EA580C] text-[#F7F3EA] flex items-center justify-center cursor-pointer shrink-0 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div
              ref={chatScrollRef}
              className="h-64 overflow-y-auto p-3 space-y-2.5 bg-[#EFE9DC]/65 dark:bg-[#060B18]/85"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs font-bold text-[#64748B] dark:text-[#94A3B8] px-4">
                  <MessageSquare className="w-7 h-7 text-[#EA580C] mb-1.5" />
                  <span>ابدأ المحادثة الآن</span>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const canDeleteMsg =
                    isAdmin ||
                    (myWorkshopId && msg.workshopId === myWorkshopId) ||
                    (myEmail && msg.authorEmail.toLowerCase() === myEmail);

                  return (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-2.5 border text-right space-y-1 ${
                        msg.isSuperAdmin
                          ? 'bg-[#FDFBF5] dark:bg-[#101C3A] border-[#EA580C]/45'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <FamilyAuthorIdentity
                          authorName={msg.authorName}
                          brandName={msg.brandName}
                          avatarUrl={msg.avatarUrl}
                          isSuperAdmin={msg.isSuperAdmin}
                          medal={msg.medal}
                          ratingStars={msg.ratingStars}
                          createdAt={msg.createdAt}
                          compact
                        />

                        {canDeleteMsg && (
                          <button
                            type="button"
                            onClick={() => handleDeleteChat(msg.id)}
                            title="حذف الرسالة"
                            className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer shrink-0 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#0C1427] dark:text-[#F7F3EA] whitespace-pre-wrap leading-relaxed pr-10">
                        {msg.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input Footer */}
            {isRestricted ? (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border-t border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-800 dark:text-amber-200 text-center">
                حسابك مقيد من المشاركة في الشات
              </div>
            ) : (
              <form
                onSubmit={handleSendChat}
                className="p-2.5 bg-[#E9E2D4] dark:bg-[#0D162E] border-t border-[#D4CCBC] dark:border-[#22355E] space-y-1.5"
              >
                {chatError && (
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    {chatError}
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={600}
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder={
                      isAdmin ? 'رسالة بصفتك كبير العيلة...' : 'اكتب رسالة سريعة للعيلة...'
                    }
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                  />
                  <button
                    type="submit"
                    disabled={chatSending || !chatDraft.trim()}
                    aria-label="إرسال رسالة في شات العيلة"
                    className="px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center cursor-pointer active:scale-95 transition shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
