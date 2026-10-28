  useEffect(() => {
    const onOpenView = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string }>).detail;
      const view = detail?.view;
      if (!view) return;

      const mapped =
        view === 'materials'
          ? 'materials'
          : view === 'treasuries'
            ? 'treasuries'
            : view === 'sales'
              ? 'sales'
              : view === 'customers'
                ? 'customers'
                : view === 'suppliers'
                  ? 'suppliers'
                  : view === 'reports'
                    ? 'reports'
                    : view === 'hr'
                      ? 'hr'
                      : null;

      if (mapped) {
        setActiveView(mapped as AppActiveView);
      }
    };

    window.addEventListener('alshams_open_view', onOpenView);
    return () => window.removeEventListener('alshams_open_view', onOpenView);
  }, [setActiveView]);

