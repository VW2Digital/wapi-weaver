import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import {
  clearPageHeaderIfOwner,
  dropHeaderIfPathChanged,
  headerHasContent,
  resolveVisibleHeader,
  type PageHeaderSnapshot,
} from "@/components/layout/page-header-state";

export type PageHeaderConfig = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
};

type PageHeaderEntry = PageHeaderSnapshot & {
  action?: ReactNode;
};

const PageHeaderStateContext = createContext<PageHeaderConfig>({});
const PageHeaderDispatchContext = createContext<Dispatch<SetStateAction<PageHeaderEntry | null>> | null>(
  null,
);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [entry, setEntry] = useState<PageHeaderEntry | null>(null);

  useLayoutEffect(() => {
    setEntry((prev) => dropHeaderIfPathChanged(prev, pathname));
  }, [pathname]);

  const visible = resolveVisibleHeader(entry, pathname);

  return (
    <PageHeaderStateContext.Provider
      value={visible ? { title: visible.title, subtitle: visible.subtitle, action: entry?.action } : {}}
    >
      <PageHeaderDispatchContext.Provider value={setEntry}>
        {visible && (
          <PageHeader title={visible.title} subtitle={visible.subtitle} action={entry?.action} />
        )}
        {children}
      </PageHeaderDispatchContext.Provider>
    </PageHeaderStateContext.Provider>
  );
}

export function usePageHeader(config: PageHeaderConfig) {
  const setEntry = useContext(PageHeaderDispatchContext);
  if (!setEntry) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }

  const ownerId = useId();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = config.title;
  const subtitle = config.subtitle;
  const action = config.action;

  useLayoutEffect(() => {
    if (!headerHasContent({ title, subtitle })) {
      setEntry((prev) => clearPageHeaderIfOwner(prev, ownerId));
      return () => {
        setEntry((prev) => clearPageHeaderIfOwner(prev, ownerId));
      };
    }

    setEntry({ ownerId, pathname, title, subtitle, action });
    return () => {
      setEntry((prev) => clearPageHeaderIfOwner(prev, ownerId));
    };
  }, [action, ownerId, pathname, setEntry, subtitle, title]);
}
