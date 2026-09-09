"use client";

import { useState } from "react";
import {
  Layers,
  Check,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { WorkTool, DeliverySettings, ALL_TOOLS } from "@/lib/workspace";
import { useWorkspaces } from "@/components/providers/workspace-provider";
import { useAppSettings } from "@/components/providers/app-providers";
import { WorkspaceToolsPicker } from "@/components/dashboard/workspace-tools-picker";

export default function WorkspacesPage() {
  const { t } = useAppSettings();
  const {
    workspaces,
    activeWork,
    addWorkspace,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
    finishSetup,
  } = useWorkspaces();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);
  const [selectedTools, setSelectedTools] = useState<WorkTool[]>([
    ...ALL_TOOLS,
  ]);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliverySettings>({
    mode: "manual",
  });

  const createNew = () => {
    if (!name.trim()) {
      setError(t("ws.needName"));
      return;
    }
    addWorkspace(name, description, selectedTools, selectedDelivery);
    setName("");
    setDescription("");
    setError("");
    setCreating(false);
    finishSetup();
  };

  const saveEdit = () => {
    if (!editing) return;
    renameWorkspace(editing.id, editing.name, editing.description);
    setEditing(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4f7cff] to-[#a78bfa] flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("ws.title")}</h1>
          <p className="text-sm text-white/60">{t("ws.subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {/* Create a workspace */}
      {creating && (
        <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 border border-[#4f7cff]/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#4f7cff]" />
            </div>
            <div>
              <h2 className="font-semibold">{t("ws.nameTitle")}</h2>
              <p className="text-sm text-white/50">{t("ws.nameDesc")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/70 block mb-1.5">
                {t("ws.nameLabel")}
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createNew()}
                placeholder={t("ws.namePlaceholder")}
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4f7cff]/60"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 block mb-1.5">
                {t("ws.optional")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={t("ws.descPlaceholder")}
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4f7cff]/60 resize-none"
              />
            </div>
          </div>

          {/* What tools do you use? */}
          <div className="border-t border-white/10 pt-5">
            <WorkspaceToolsPicker
              initialTools={selectedTools}
              initialDelivery={selectedDelivery}
              title={t("onboard.question")}
              onSave={(tools, delivery) => {
                setSelectedTools(tools);
                setSelectedDelivery(delivery);
              }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={createNew}
              className="flex-1 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 text-white font-medium px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Check className="w-5 h-5" /> {t("ws.createWorkspace")}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="border border-white/15 hover:border-white/40 text-white/70 px-5 py-3 rounded-xl text-sm transition"
            >
              {t("ws.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Workspaces list */}
      {!creating && workspaces.length === 0 && (
        <div className="border border-white/10 rounded-3xl bg-white/[0.02] py-16 text-center">
          <p className="text-sm text-white/60">{t("ws.noWorkspaces")}</p>
        </div>
      )}

      {!creating && workspaces.length > 0 && (
        <div className="space-y-3">
          {workspaces.map((ws) => {
            const isActive = activeWork?.id === ws.id;
            return (
              <div
                key={ws.id}
                className={`border rounded-2xl p-4 transition ${
                  isActive
                    ? "border-[#4f7cff]/50 bg-[#4f7cff]/5"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {editing?.id === ws.id ? (
                  <div className="space-y-3">
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                      className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4f7cff]/60"
                    />
                    <input
                      value={editing.description}
                      onChange={(e) =>
                        setEditing({ ...editing, description: e.target.value })
                      }
                      placeholder={t("ws.optional")}
                      className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4f7cff]/60"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-xl px-3 py-1.5 text-sm transition hover:bg-emerald-500/25"
                      >
                        {t("ws.save")}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="border border-white/15 text-white/60 rounded-xl px-3 py-1.5 text-sm transition"
                      >
                        {t("ws.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ws.color} flex items-center justify-center font-bold text-white shrink-0`}
                    >
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ws.name}</p>
                      {ws.description && (
                        <p className="text-xs text-white/50 truncate">
                          {ws.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => switchWorkspace(ws.id)}
                        className={`rounded-xl px-3 py-1.5 text-sm transition ${
                          isActive
                            ? "bg-[#4f7cff] text-white"
                            : "border border-white/15 text-white/70 hover:bg-white/5"
                        }`}
                      >
                        {isActive ? t("ws.active") : t("ws.activate")}
                      </button>
                      <button
                        onClick={() =>
                          setEditing({
                            id: ws.id,
                            name: ws.name,
                            description: ws.description,
                          })
                        }
                        title={t("ws.edit")}
                        className="text-white/50 hover:text-[#4f7cff] rounded-xl p-2 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteWorkspace(ws.id)}
                        title={t("ws.delete")}
                        disabled={workspaces.length <= 1}
                        className="text-white/50 hover:text-red-500 rounded-xl p-2 transition disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add workspace */}
      {!creating && workspaces.length > 0 && (
        <button
          onClick={() => setCreating(true)}
          className="w-full border-2 border-dashed border-white/15 hover:border-[#4f7cff]/50 text-white/70 rounded-2xl py-4 flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-5 h-5" /> {t("ws.addWorkspace")}
        </button>
      )}

      {!creating && workspaces.length === 0 && (
        <button
          onClick={() => setCreating(true)}
          className="w-full border-2 border-dashed border-white/15 hover:border-[#4f7cff]/50 text-white/70 rounded-2xl py-4 flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-5 h-5" /> {t("ws.addWorkspace")}
        </button>
      )}
    </div>
  );
}
