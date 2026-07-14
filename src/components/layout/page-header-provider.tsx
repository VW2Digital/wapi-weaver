import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { PageHeader } from "@/components/layout/page-header";

export type PageHeaderConfig = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
};

const PageHeaderStateContext = createContext<PageHeaderConfig>({});
const PageHeaderDispatchContext = createContext<Dispatch<SetStateAction<PageHeaderConfig>> | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageHeaderConfig>({});

  return (
    <PageHeaderStateContext.Provider value={config}>
      <PageHeaderDispatchContext.Provider value={setConfig}>
        {(config.title || config.subtitle) && (
          <PageHeader title={config.title} subtitle={config.subtitle} action={config.action} />
        )}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </PageHeaderDispatchContext.Provider>
    </PageHeaderStateContext.Provider>
  );
}

export function usePageHeader(config: PageHeaderConfig) {
  const setConfig = useContext(PageHeaderDispatchContext);
  if (!setConfig) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }

  const title = config.title;
  const subtitle = config.subtitle;
  const action = config.action;

  useEffect(() => {
    setConfig((prev) => {
      if (
        prev.title === title &&
        prev.subtitle === subtitle &&
        prev.action === action
      ) {
        return prev;
      }
      return { title, subtitle, action };
    });
  }, [title, subtitle, action, setConfig]);
}

