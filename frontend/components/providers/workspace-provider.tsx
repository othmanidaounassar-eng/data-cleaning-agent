"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Workstate,
  Workspace,
  WorkTool,
  DeliverySettings,
  ALL_TOOLS,
  createWorkspace,
  markSetupDone,
  readWorkstate,
  writeActive,
  writeWorkspaces,
} from "@/lib/workspace";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWork: Workspace | null;
  setupDone: boolean;
  addWorkspace: (
    name: string,
    description: string,
    tools?: WorkTool[],
    delivery?: DeliverySettings,
  ) => Workspace | null;
  renameWorkspace: (id: string, name: string, description: string) => void;
  deleteWorkspace: (id: string) => void;
  switchWorkspace: (id: string) => void;
  setWorkspaceTools: (id: string, tools: WorkTool[]) => void;
  setWorkspaceDelivery: (id: string, delivery: DeliverySettings) => void;
  finishSetup: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Workstate>(() =>
    typeof window === "undefined"
      ? { workspaces: [], activeWorkId: null, setupDone: false }
      : readWorkstate(),
  );

  // Keep localStorage in sync on every change.
  useEffect(() => {
    writeWorkspaces(state.workspaces);
    writeActive(state.activeWorkId);
  }, [state.workspaces, state.activeWorkId]);

  const addWorkspace = useCallback(
    (
      name: string,
      description: string,
      tools?: WorkTool[],
      delivery?: DeliverySettings,
    ) => {
      let created: Workspace | null = null;
      setState((prev) => {
        created = createWorkspace(
          prev.workspaces,
          name,
          description,
          tools,
          delivery,
        );
        const workspaces = [...prev.workspaces, created];
        return {
          ...prev,
          workspaces,
          activeWorkId: created.id,
          setupDone: true,
        };
      });
      markSetupDone();
      return created;
    },
    [],
  );

  const renameWorkspace = useCallback(
    (id: string, name: string, description: string) => {
      setState((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) =>
          w.id === id
            ? {
                ...w,
                name: name.trim() || w.name,
                description: description.trim(),
              }
            : w,
        ),
      }));
    },
    [],
  );

  const deleteWorkspace = useCallback((id: string) => {
    setState((prev) => {
      const workspaces = prev.workspaces.filter((w) => w.id !== id);
      const activeWorkId =
        prev.activeWorkId === id
          ? workspaces[0]?.id ?? null
          : prev.activeWorkId;
      return { ...prev, workspaces, activeWorkId };
    });
  }, []);

  const switchWorkspace = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.workspaces.some((w) => w.id === id)) return prev;
      return { ...prev, activeWorkId: id };
    });
  }, []);

  const setWorkspaceTools = useCallback((id: string, tools: WorkTool[]) => {
    setState((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((w) =>
        w.id === id
          ? { ...w, tools: tools && tools.length ? tools : [...ALL_TOOLS] }
          : w,
      ),
    }));
  }, []);

  const setWorkspaceDelivery = useCallback(
    (id: string, delivery: DeliverySettings) => {
      setState((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) =>
          w.id === id ? { ...w, delivery } : w,
        ),
      }));
    },
    [],
  );

  const finishSetup = useCallback(() => {
    markSetupDone();
    setState((prev) => ({ ...prev, setupDone: true }));
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces: state.workspaces,
      activeWork:
        state.workspaces.find((w) => w.id === state.activeWorkId) ?? null,
      setupDone: state.setupDone,
      addWorkspace,
      renameWorkspace,
      deleteWorkspace,
      switchWorkspace,
      setWorkspaceTools,
      setWorkspaceDelivery,
      finishSetup,
    }),
    [
      state,
      addWorkspace,
      renameWorkspace,
      deleteWorkspace,
      switchWorkspace,
      setWorkspaceTools,
      setWorkspaceDelivery,
      finishSetup,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaces(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaces must be used within <WorkspaceProvider>");
  }
  return ctx;
}
