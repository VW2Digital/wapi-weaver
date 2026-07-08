import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/layout/page-header";

export type PageHeaderConfig = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
};

type ContextValue = {
  config: PageHeaderConfig;
  setConfig: React.Dispatch<React.SetStateAction<PageHeaderConfig>>;
};

const PageHeaderContext = createContext<ContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageHeaderConfig>({});

  return (
    <PageHeaderContext.Provider value={{ config, setConfig }}>
      {(config.title || config.subtitle) && (
        <PageHeader title={config.title} subtitle={config.subtitle} action={config.action} />
      )}
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader(config: PageHeaderConfig) {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeader must be used within PageHeaderProvider");

  ctx.setConfig((prev) => {
    if (prev.title === config.title && prev.subtitle === config.subtitle) {
      return prev;
    }
    return { title: config.title, subtitle: config.subtitle, action: config.action };
  });
}
