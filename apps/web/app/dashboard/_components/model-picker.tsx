"use client";

import { useEffect, useState } from "react";
import {
  fetchModels,
  type ModelInfo,
  type ModelProvider,
  type ModelsConfig,
} from "../_lib/projects";

/* ------------------------------------------------------------------ *
 * Per-stage model picker. One "Model" dropdown sets the default for every
 * stage; an optional panel overrides individual stages. Reports the
 * selection up as { defaultModelId, overrides } — the server resolves it
 * to a concrete per-stage map. Only providers with a key configured appear.
 * ------------------------------------------------------------------ */

export interface ModelSelection {
  defaultModelId: string;
  overrides: Record<string, string>;
}

const PROVIDER_ORDER: ModelProvider[] = ["anthropic", "openai", "google", "free"];
const PROVIDER_LABEL: Record<ModelProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google (Free)",
  free: "Free (OpenRouter)",
};

const prettyStage = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A native <select> styled like the Geist inputs, grouped by provider. */
function ModelSelect({
  models,
  value,
  onChange,
  ariaLabel,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--gray-alpha-300)] bg-[var(--background-100)] px-3 py-2 text-[13px] text-[var(--gray-1000)] focus:border-[var(--gray-1000)]"
    >
      {PROVIDER_ORDER.filter((p) => models.some((m) => m.provider === p)).map((provider) => (
        <optgroup key={provider} label={PROVIDER_LABEL[provider]}>
          {models
            .filter((m) => m.provider === provider)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function ModelPicker({ onChange }: { onChange: (sel: ModelSelection) => void }) {
  const [config, setConfig] = useState<ModelsConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultModelId, setDefaultModelId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchModels(controller.signal)
      .then((cfg) => {
        if (controller.signal.aborted) return;
        setConfig(cfg);
        setDefaultModelId(cfg.defaultModelId);
        onChange({ defaultModelId: cfg.defaultModelId, overrides: {} });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Couldn't load models.");
      });
    return () => controller.abort();
    // onChange is stable from the parent; intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDefault = (id: string) => {
    setDefaultModelId(id);
    onChange({ defaultModelId: id, overrides });
  };

  const updateOverride = (stage: string, id: string) => {
    // An override equal to the default is just the default — drop it.
    const next = { ...overrides };
    if (id === defaultModelId) delete next[stage];
    else next[stage] = id;
    setOverrides(next);
    onChange({ defaultModelId, overrides: next });
  };

  if (error) {
    return <p className="text-[12px] text-[var(--red-900)]">{error}</p>;
  }

  if (!config) {
    return <div className="h-9 w-44 animate-pulse rounded-lg bg-[var(--gray-100)]" />;
  }

  if (config.models.length === 0) {
    return (
      <p className="text-[12px] text-[var(--amber-700)]">
        No AI providers configured — add an OpenAI, Anthropic, Google, or OpenRouter key.
      </p>
    );
  }

  const overrideCount = Object.keys(overrides).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-[var(--gray-1000)]">Model</span>
        <ModelSelect
          models={config.models}
          value={defaultModelId}
          onChange={updateDefault}
          ariaLabel="Default model for all stages"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[12px] text-[var(--blue-700)] hover:underline"
        >
          {expanded ? "Hide per-stage" : "Customize per stage"}
          {overrideCount > 0 && !expanded ? ` (${overrideCount})` : ""}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-2 rounded-xl border border-[var(--gray-alpha-300)] bg-[var(--background-200)] p-3 sm:grid-cols-2">
          {config.stages.map((stage) => (
            <div key={stage} className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-[var(--gray-900)]">{prettyStage(stage)}</span>
              <ModelSelect
                models={config.models}
                value={overrides[stage] ?? defaultModelId}
                onChange={(id) => updateOverride(stage, id)}
                ariaLabel={`Model for the ${stage} stage`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
