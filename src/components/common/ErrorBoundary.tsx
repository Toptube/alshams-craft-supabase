import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, Home, Sparkles, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Al-Shams ErrorBoundary Caught Fatal Component Crash]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    if (this.props.onReset) {
      this.setState({ hasError: false, error: null, errorInfo: null });
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    try {
      if (window.location.pathname !== '/') {
        window.location.href = '/';
        return;
      }
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleSafeReset = () => {
    try {
      sessionStorage.clear();
      // Remove temporary transient flags, keeping user profile and offline database
      sessionStorage.removeItem('alshams_welcome_shown');
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'استثناء غير متوقع أثناء تحميل الواجهة';

      return (
        <div
          dir="rtl"
          className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#FDFBF7] dark:bg-[#060B18] text-[#0A1128] dark:text-[#FDFBF7] font-sans selection:bg-amber-500 selection:text-white"
        >
          <div className="max-w-xl w-full bg-white dark:bg-stone-900 border-2 border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
            {/* Logo & Emblem */}
            <div className="relative inline-flex items-center justify-center mx-auto">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 flex items-center justify-center p-3 shadow-inner">
                <img
                  src="/alshams_falcon_emblem.png"
                  alt="شعار صقر الشمساوية"
                  className="w-full h-full object-contain drop-shadow"
                  onError={(e) => {
                    // Fallback to emoji if asset fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-md">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            {/* Header Text */}
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                صيانة طارئة سريعة | عائلة الشمساوية
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                {this.props.fallbackTitle || 'يا فنان، حصل توقف مفاجئ في تحميل الشاشة!'}
              </h1>
              <p className="text-sm font-medium text-stone-600 dark:text-stone-300 leading-relaxed max-w-md mx-auto">
                متشيلش هم أبداً، بيانات ورشتك، خاماتك، حساباتك، وسجلاتك محفوظة بأمان تام في قاعدة البيانات. نقدر نعيد تشغيل الواجهة فوراً بضغطة زر واحدة.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تشغيل المنظومة</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-sm transition cursor-pointer active:scale-95 border border-stone-200 dark:border-stone-700"
              >
                <Home className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>

            {/* Safe Reset Action */}
            <button
              type="button"
              onClick={this.handleSafeReset}
              className="text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition underline underline-offset-4 cursor-pointer"
            >
              تصفير الذاكرة المؤقتة وإعادة الدخول الآمن 🧹
            </button>

            {/* Technical Trace Accordion */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 text-right">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="flex items-center justify-between w-full text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 py-1 cursor-pointer"
              >
                <span>تفاصيل العطل التقني (للمهندس والمطورين)</span>
                {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-2 p-3 rounded-xl bg-stone-950 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48 text-left dir-ltr">
                  <p className="font-bold text-rose-400 mb-1">{errorMessage}</p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="whitespace-pre-wrap text-[10px] text-stone-400">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Quality Guarantee Footer */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-stone-500 dark:text-stone-400 pt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>منظومة الشمساوية الذكية | حماية البيانات واستمرارية التشغيل 100%</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
