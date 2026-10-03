import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Check,
  DollarSign,
  Eye,
  ExternalLink,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MediaPicker,
  type MetaAdsMedia,
} from "@/components/meta-ads/MediaPicker";
import { toast } from "sonner";

type Period = "hoje" | "ontem" | "7_dias" | "30_dias" | "este_mes";

type DashboardData = {
  ok: true;
  cached: boolean;
  account: { id: string; name: string | null; currency: string };
  has_data: boolean;
  summary: {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversations: number | null;
    leads: number | null;
    purchases: number | null;
    roas: number | null;
    results: number | null;
    cost_per_result: number | null;
  } | null;
  daily: Array<{
    date: string;
    spend: number;
    clicks: number;
    conversations: number;
  }>;
  campaigns: Array<{
    id: string;
    graph_id: string | null;
    platform_id: string | null;
    source: "platform" | "meta";
    name: string;
    status: string;
    spend: number;
    clicks: number;
    ctr: number;
    cpc: number;
    results: number | null;
    cost_per_result: number | null;
  }>;
};

type DashboardError = {
  ok: false;
  code: string;
  message: string;
};

type TargetingOption = {
  id: string;
  name: string;
  key?: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  audience_size_scope?: "country" | "city";
};

type AudienceEstimate = {
  audience_size_lower_bound: number;
  audience_size_upper_bound: number;
};

type MonthlyAvailability = {
  monthly_cap: number;
  spent: number;
  available: number;
};

type CampaignDraft = {
  id: string;
  title: string;
  text: string;
  preview?: Record<string, unknown>;
};

type WizardAutosave = {
  version: 1;
  updatedAt: string;
  step: number;
  objective: CampaignObjective;
  destinationUrl: string;
  whatsappMessage: string;
  radiusKm: string;
  ageMin: string;
  ageMax: string;
  gender: Gender;
  specialCategory: SpecialCategory;
  selectedMedia: MetaAdsMedia | null;
  productTitle: string;
  productPrice: string;
  productLink: string;
  cityQuery: string;
  interestQuery: string;
  behaviorQuery: string;
  selectedCity: TargetingOption | null;
  selectedInterests: TargetingOption[];
  selectedBehaviors: TargetingOption[];
  dailyBudget: string;
  durationDays: string;
  draft: CampaignDraft | null;
  serverDraftId: string | null;
};

type ServerDraft = {
  id: string;
  rascunho: Record<string, unknown>;
  status: "rascunho";
  orcamento_diario: number;
  duracao_dias: number;
  gasto_maximo: number;
  criado_em: string;
  atualizado_em: string;
};

type OfficialPreview = {
  placement: string;
  format: string;
  body: string;
};

type CampaignObjective = "whatsapp" | "site";
type Gender = "all" | "male" | "female";
type SpecialCategory =
  | ""
  | "CREDIT"
  | "EMPLOYMENT"
  | "HOUSING"
  | "ISSUES_ELECTIONS_POLITICS"
  | "FINANCIAL_PRODUCTS_SERVICES";

type CampaignActionError = {
  code: string;
  message: string;
  billingUrl?: string;
};

type PaymentStatus = {
  ok: true;
  account_id: string;
  billing_url: string;
  account_active: boolean;
  payment_configured: boolean;
};

type FacebookSdk = {
  init(options: { appId: string; version: string; xfbml: boolean }): void;
  ui(
    options: {
      method: "ads_payment";
      account_id: string;
      display: "popup";
    },
    callback: (response: unknown) => void,
  ): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const META_APP_ID = "1254152493364240";
const META_SDK_ID = "meta-ads-facebook-jssdk";
const DEFAULT_WHATSAPP_MESSAGE =
  "Olá! Vi seu anúncio e gostaria de saber mais.";

const STEPS = ["Objetivo", "Público", "Orçamento", "Criativo e revisão"];

const ERROR_MESSAGES: Record<string, string> = {
  not_connected: "Conecte sua conta de anúncios antes de continuar.",
  meta_ads_not_ready: "Selecione uma conta de anúncios nas configurações.",
  facebook_page_not_ready: "Conecte uma Página do Facebook antes de continuar.",
  whatsapp_not_ready: "Seu WhatsApp ainda não está pronto para receber anúncios.",
  funding_source_required: "Adicione uma forma de pagamento à conta de anúncios.",
  monthly_cap_exceeded: "Esta campanha ultrapassa seu limite mensal de anúncios.",
  token_expired: "Sua conexão com o Meta expirou. Reconecte a conta.",
  unauthorized: "Sua sessão expirou. Entre novamente.",
  explicit_confirmation_required: "Confirme a publicação para continuar.",
  ad_account_not_active: "Sua conta de anúncios não está ativa.",
  invalid_draft: "Revise os campos da campanha.",
};

async function getCampaignError(
  invokeError: unknown,
  response: Record<string, unknown> | null,
  fallback: string,
): Promise<CampaignActionError> {
  let payload = response;
  const context = (invokeError as { context?: Response } | null)?.context;
  if (context instanceof Response) {
    try {
      payload = await context.clone().json() as Record<string, unknown>;
    } catch {
      // Keep the response body already returned by the client.
    }
  }
  const code = String(
    payload?.error ?? payload?.code ??
      (context instanceof Response && context.status === 401
        ? "unauthorized"
        : "request_failed"),
  );
  return {
    code,
    message: String(payload?.message ?? ERROR_MESSAGES[code] ?? fallback),
    billingUrl: typeof payload?.billing_url === "string" ? payload.billing_url : undefined,
  };
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7_dias", label: "7 dias" },
  { value: "30_dias", label: "30 dias" },
  { value: "este_mes", label: "Este mês" },
];

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);

const integer = (value: number | null | undefined) =>
  Math.round(value ?? 0).toLocaleString("pt-BR");

const decimal = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Encerrada",
  DELETED: "Encerrada",
  COMPLETED: "Encerrada",
  ERROR: "Erro",
  CAMPAIGN_PAUSED: "Pausada",
  ADSET_PAUSED: "Conjunto pausado",
};

const INTEREST_PRESETS = [
  {
    name: "Profissionais liberais",
    queries: [
      ["Odontologia", "Dentista"],
      ["Psicologia"],
      ["Direito"],
      ["Nutrição"],
      ["Fisioterapia"],
      ["Contabilidade"],
      ["Arquitetura"],
    ],
  },
  {
    name: "Empreendedores e pequenos negócios",
    queries: [["Empreendedorismo"], ["Pequena empresa"], ["Marketing digital"]],
  },
  {
    name: "Comércio local",
    queries: [["Compras"], ["Restaurantes"], ["Pequenas empresas"]],
  },
  {
    name: "Beleza e estética",
    queries: [
      ["Salão de beleza"],
      ["Cosméticos"],
      ["Cuidados com a pele"],
      ["Maquiagem"],
    ],
  },
] as const;

const audienceRange = (option: TargetingOption) => {
  if (!option.audience_size_scope) return null;
  const lower = option.audience_size_lower_bound;
  const upper = option.audience_size_upper_bound;
  return Number.isFinite(lower) && Number.isFinite(upper)
    ? `${integer(lower)}–${integer(upper)} pessoas`
    : null;
};

const normalizeTargetingName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const UNSAFE_PRESET_TERMS = [
  "faculdade",
  "ensino superior",
  "estudante",
  "curso",
  "universidade",
];

const closestSafeInterest = (
  options: TargetingOption[],
  queries: readonly string[],
) => {
  const normalizedQueries = queries.map(normalizeTargetingName);
  return options
    .filter((option) => {
      const name = normalizeTargetingName(option.name);
      const matches = normalizedQueries.some((query) =>
        name === query || name.startsWith(`${query} `)
      );
      const changesMeaning = option.name.includes("(") ||
        normalizedQueries.some((query) =>
          query === "moda" && name !== query
        );
      return matches && !changesMeaning &&
        !UNSAFE_PRESET_TERMS.some((term) => name.includes(term));
    })
    .map((option) => {
      const name = normalizeTargetingName(option.name);
      const score = Math.min(...normalizedQueries.map((query) =>
        name === query
          ? 0
          : name.startsWith(`${query} `)
          ? 10 + name.length - query.length
          : Number.POSITIVE_INFINITY
      ));
      return { option, score };
    })
    .sort((left, right) => left.score - right.score)[0]?.option ?? null;
};

export default function MetaAdsDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("7_dias");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [campaignActionLoading, setCampaignActionLoading] = useState<
    string | null
  >(null);
  const [showWizard, setShowWizard] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [savedWizard, setSavedWizard] = useState<WizardAutosave | null>(null);
  const [wizardStarted, setWizardStarted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [serverDrafts, setServerDrafts] = useState<ServerDraft[]>([]);
  const [serverDraftsLoading, setServerDraftsLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<CampaignObjective>("whatsapp");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState(
    DEFAULT_WHATSAPP_MESSAGE,
  );
  const [radiusKm, setRadiusKm] = useState("25");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [gender, setGender] = useState<Gender>("all");
  const [specialCategory, setSpecialCategory] = useState<SpecialCategory>("");
  const [selectedMedia, setSelectedMedia] = useState<MetaAdsMedia | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productLink, setProductLink] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [interestQuery, setInterestQuery] = useState("");
  const [behaviorQuery, setBehaviorQuery] = useState("");
  const [cities, setCities] = useState<TargetingOption[]>([]);
  const [interests, setInterests] = useState<TargetingOption[]>([]);
  const [behaviors, setBehaviors] = useState<TargetingOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<TargetingOption | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<TargetingOption[]>([]);
  const [selectedBehaviors, setSelectedBehaviors] = useState<TargetingOption[]>([]);
  const [interestFocused, setInterestFocused] = useState(false);
  const [emptySearch, setEmptySearch] = useState<
    Partial<Record<"city" | "interest" | "behavior", string>>
  >({});
  const [targetingLoading, setTargetingLoading] = useState<
    "city" | "interest" | "behavior" | null
  >(null);
  const [audienceEstimate, setAudienceEstimate] = useState<AudienceEstimate | null>(null);
  const [audienceEstimateLoading, setAudienceEstimateLoading] = useState(false);
  const [monthlyAvailability, setMonthlyAvailability] =
    useState<MonthlyAvailability | null>(null);
  const [monthlyAvailabilityLoading, setMonthlyAvailabilityLoading] =
    useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [dailyBudget, setDailyBudget] = useState("20");
  const [durationDays, setDurationDays] = useState("7");
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [officialPreview, setOfficialPreview] = useState<OfficialPreview[] | null>(null);
  const [wizardLoading, setWizardLoading] = useState<"draft" | "preview" | "publish" | null>(null);
  const [published, setPublished] = useState(false);
  const [actionError, setActionError] = useState<CampaignActionError | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentOAuthLoading, setPaymentOAuthLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [facebookSdkReady, setFacebookSdkReady] = useState(false);
  const restoringHistoryRef = useRef(false);
  const wizardStateRef = useRef<WizardAutosave | null>(null);

  const selectedMediaId = selectedMedia?.id ?? "";
  const totalBudget = (Number(dailyBudget) || 0) * (Number(durationDays) || 0);
  const exceedsMonthlyAvailability = Boolean(
    monthlyAvailability && totalBudget > monthlyAvailability.available,
  );
  const suggestedDailyBudget = monthlyAvailability && Number(durationDays) > 0
    ? Math.floor(
      monthlyAvailability.available / Number(durationDays) * 100,
    ) / 100
    : 0;
  const storageKey = userId ? `meta_ads_wizard_${userId}` : null;

  const wizardState = useMemo<WizardAutosave>(() => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    step,
    objective,
    destinationUrl,
    whatsappMessage,
    radiusKm,
    ageMin,
    ageMax,
    gender,
    specialCategory,
    selectedMedia,
    productTitle,
    productPrice,
    productLink,
    cityQuery,
    interestQuery,
    behaviorQuery,
    selectedCity,
    selectedInterests,
    selectedBehaviors,
    dailyBudget,
    durationDays,
    draft,
    serverDraftId,
  }), [
    step,
    objective,
    destinationUrl,
    whatsappMessage,
    radiusKm,
    ageMin,
    ageMax,
    gender,
    specialCategory,
    selectedMedia,
    productTitle,
    productPrice,
    productLink,
    cityQuery,
    interestQuery,
    behaviorQuery,
    selectedCity,
    selectedInterests,
    selectedBehaviors,
    dailyBudget,
    durationDays,
    draft,
    serverDraftId,
  ]);
  wizardStateRef.current = wizardState;

  const resetWizard = () => {
    setStep(0);
    setObjective("whatsapp");
    setDestinationUrl("");
    setWhatsappMessage(DEFAULT_WHATSAPP_MESSAGE);
    setRadiusKm("25");
    setAgeMin("18");
    setAgeMax("65");
    setGender("all");
    setSpecialCategory("");
    setSelectedMedia(null);
    setProductTitle("");
    setProductPrice("");
    setProductLink("");
    setCityQuery("");
    setInterestQuery("");
    setBehaviorQuery("");
    setCities([]);
    setInterests([]);
    setBehaviors([]);
    setSelectedCity(null);
    setSelectedInterests([]);
    setSelectedBehaviors([]);
    setDailyBudget("20");
    setDurationDays("7");
    setDraft(null);
    setServerDraftId(null);
    setOfficialPreview(null);
    setActionError(null);
    setPublished(false);
  };

  const applyWizardState = (
    state: WizardAutosave,
    forcedServerDraftId?: string,
  ) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, Number(state.step) || 0)));
    setObjective(state.objective === "site" ? "site" : "whatsapp");
    setDestinationUrl(String(state.destinationUrl ?? ""));
    setWhatsappMessage(
      String(state.whatsappMessage ?? DEFAULT_WHATSAPP_MESSAGE),
    );
    setRadiusKm(String(state.radiusKm ?? "25"));
    setAgeMin(String(state.ageMin ?? "18"));
    setAgeMax(String(state.ageMax ?? "65"));
    setGender(["male", "female"].includes(state.gender) ? state.gender : "all");
    setSpecialCategory(state.specialCategory ?? "");
    setSelectedMedia(state.selectedMedia ?? null);
    setProductTitle(String(state.productTitle ?? ""));
    setProductPrice(String(state.productPrice ?? ""));
    setProductLink(String(state.productLink ?? ""));
    setCityQuery(String(state.cityQuery ?? ""));
    setInterestQuery(String(state.interestQuery ?? ""));
    setBehaviorQuery(String(state.behaviorQuery ?? ""));
    setSelectedCity(state.selectedCity ?? null);
    setSelectedInterests(
      Array.isArray(state.selectedInterests) ? state.selectedInterests : [],
    );
    setSelectedBehaviors(
      Array.isArray(state.selectedBehaviors) ? state.selectedBehaviors : [],
    );
    setDailyBudget(String(state.dailyBudget ?? "20"));
    setDurationDays(String(state.durationDays ?? "7"));
    setDraft(state.draft ?? null);
    setServerDraftId(forcedServerDraftId ?? state.serverDraftId ?? null);
    setOfficialPreview(null);
    setActionError(null);
    setPublished(false);
    setWizardStarted(true);
    setShowWizard(true);
    setResumePromptOpen(false);
  };

  const openWizard = () => {
    if (savedWizard) {
      setResumePromptOpen(true);
      return;
    }
    setWizardStarted(true);
    setShowWizard(true);
  };

  const startNewWizard = (askConfirmation: boolean) => {
    if (
      askConfirmation &&
      !window.confirm(
        "Começar uma nova campanha? O progresso salvo neste navegador será apagado.",
      )
    ) return;
    if (storageKey) localStorage.removeItem(storageKey);
    setSavedWizard(null);
    resetWizard();
    setWizardStarted(true);
    setShowWizard(true);
    setResumePromptOpen(false);
  };

  const closeWizard = () => {
    if (
      wizardStarted && !published &&
      !window.confirm(
        "Sair? Seu progresso fica salvo e você pode continuar depois.",
      )
    ) return;
    setShowWizard(false);
  };

  const leavePage = (path: string) => {
    if (
      wizardStarted && !published &&
      !window.confirm(
        "Você tem uma campanha em andamento. Deseja sair mesmo?",
      )
    ) return;
    if (storageKey) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...wizardState, updatedAt: new Date().toISOString() }),
      );
    }
    setWizardStarted(false);
    navigate(path);
  };

  const loadServerDrafts = useCallback(async () => {
    setServerDraftsLoading(true);
    const { data: response, error: invokeError } =
      await supabase.functions.invoke("meta-ads-draft", {
        body: { action: "list" },
      });
    if (invokeError || !response?.ok) {
      const failure = await getCampaignError(
        invokeError,
        response,
        "Não foi possível carregar os rascunhos.",
      );
      if (failure.code === "unauthorized") setSessionExpired(true);
      setServerDrafts([]);
    } else {
      setServerDrafts((response.data ?? []) as ServerDraft[]);
    }
    setServerDraftsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: auth }) => {
      if (!active || !auth.user) return;
      setUserId(auth.user.id);
      const key = `meta_ads_wizard_${auth.user.id}`;
      try {
        const parsed = JSON.parse(
          localStorage.getItem(key) ?? "null",
        ) as WizardAutosave | null;
        if (parsed?.version === 1) {
          setSavedWizard(parsed);
          setResumePromptOpen(true);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
    void loadServerDrafts();
    return () => {
      active = false;
    };
  }, [loadServerDrafts]);

  const continueServerDraft = (row: ServerDraft) => {
    const raw = row.rascunho ?? {};
    const embedded = raw.wizard_state &&
        typeof raw.wizard_state === "object" &&
        !Array.isArray(raw.wizard_state)
      ? raw.wizard_state as WizardAutosave
      : null;
    const restored: WizardAutosave = embedded?.version === 1
      ? { ...embedded }
      : {
        version: 1,
        updatedAt: row.atualizado_em,
        step: 3,
        objective: raw.objective === "site" ? "site" : "whatsapp",
        destinationUrl: String(raw.destination_url ?? ""),
        whatsappMessage: String(
          raw.whatsapp_message ?? DEFAULT_WHATSAPP_MESSAGE,
        ),
        radiusKm: String(raw.radius_km ?? "25"),
        ageMin: String(raw.age_min ?? "18"),
        ageMax: String(raw.age_max ?? "65"),
        gender: raw.gender === "male" || raw.gender === "female"
          ? raw.gender
          : "all",
        specialCategory: Array.isArray(raw.special_ad_categories)
          ? (raw.special_ad_categories[0] as SpecialCategory) ?? ""
          : "",
        selectedMedia: null,
        productTitle: String(raw.headline ?? raw.name ?? ""),
        productPrice: "",
        productLink: "",
        cityQuery: "",
        interestQuery: "",
        behaviorQuery: "",
        selectedCity: Array.isArray(raw.cities)
          ? raw.cities[0] as TargetingOption ?? null
          : null,
        selectedInterests: Array.isArray(raw.interests)
          ? raw.interests as TargetingOption[]
          : [],
        selectedBehaviors: Array.isArray(raw.behaviors)
          ? raw.behaviors as TargetingOption[]
          : [],
        dailyBudget: String(raw.daily_budget ?? row.orcamento_diario ?? "20"),
        durationDays: String(raw.duration_days ?? row.duracao_dias ?? "7"),
        draft: null,
        serverDraftId: row.id,
      };
    const title = String(raw.headline ?? restored.draft?.title ?? "");
    const text = String(raw.primary_text ?? restored.draft?.text ?? "");
    if (title && text) {
      restored.draft = { id: row.id, title, text };
    }
    restored.step = 3;
    applyWizardState(restored, row.id);
  };

  const deleteServerDraft = async (row: ServerDraft) => {
    if (!window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.")) {
      return;
    }
    const { data: response, error: invokeError } =
      await supabase.functions.invoke("meta-ads-draft", {
        body: { action: "delete", id: row.id },
      });
    if (invokeError || !response?.ok) {
      const failure = await getCampaignError(
        invokeError,
        response,
        "Não foi possível excluir o rascunho.",
      );
      if (failure.code === "unauthorized") {
        setSessionExpired(true);
      } else {
        toast.error(failure.message);
      }
      return;
    }
    setServerDrafts((current) =>
      current.filter((draftRow) => draftRow.id !== row.id)
    );
    if (serverDraftId === row.id || savedWizard?.serverDraftId === row.id) {
      const localOnly = {
        ...wizardState,
        serverDraftId: null,
        updatedAt: new Date().toISOString(),
      };
      setServerDraftId(null);
      setDraft(null);
      setWizardStarted(false);
      setShowWizard(false);
      setSavedWizard(localOnly);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(localOnly));
      }
    }
    toast.success("Rascunho excluído.");
  };

  useEffect(() => {
    if (!storageKey || !wizardStarted || published) return;
    const timeout = window.setTimeout(() => {
      const saved = { ...wizardState, updatedAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify(saved));
      setSavedWizard(saved);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [storageKey, wizardStarted, published, wizardState]);

  useEffect(() => {
    if (!wizardStarted || published) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (storageKey && wizardStateRef.current) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...wizardStateRef.current,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      event.preventDefault();
      event.returnValue =
        "Você tem uma campanha em andamento. Deseja sair mesmo?";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [wizardStarted, published, storageKey]);

  useEffect(() => {
    if (!wizardStarted || published) return;
    window.history.pushState(
      { ...window.history.state, metaAdsWizardGuard: true },
      "",
      window.location.href,
    );
    const handlePopState = () => {
      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false;
        return;
      }
      if (
        window.confirm(
          "Você tem uma campanha em andamento. Deseja sair mesmo?",
        )
      ) {
        if (storageKey && wizardStateRef.current) {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              ...wizardStateRef.current,
              updatedAt: new Date().toISOString(),
            }),
          );
        }
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
      } else {
        restoringHistoryRef.current = true;
        window.history.forward();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [wizardStarted, published, storageKey]);

  useEffect(() => {
    if (step !== 3 || !wizardStarted || published || wizardLoading) return;
    let active = true;
    const timeout = window.setTimeout(async () => {
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-draft", {
          body: {
            action: "save_wizard",
            id: serverDraftId,
            wizard_state: wizardState,
          },
        });
      if (!active) return;
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível salvar o rascunho na conta.",
        );
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          setActionError(failure);
        }
        return;
      }
      const saved = response.data as ServerDraft;
      if (!serverDraftId && saved?.id) setServerDraftId(saved.id);
      if (saved?.id) {
        setServerDrafts((current) => {
          const next = current.filter((row) => row.id !== saved.id);
          return [saved, ...next];
        });
      }
    }, 700);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    step,
    wizardStarted,
    published,
    wizardLoading,
    serverDraftId,
    wizardState,
  ]);

  const searchTargeting = async (type: "city" | "interest" | "behavior") => {
    const query = type === "city"
      ? cityQuery
      : type === "interest"
      ? interestQuery
      : behaviorQuery;
    if (query.trim().length < 2) return;
    const searchedTerm = query.trim();
    setTargetingLoading(type);
    setEmptySearch((current) => ({ ...current, [type]: undefined }));
    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "meta-ads-targeting-search",
        { body: { type, query: searchedTerm } },
      );
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível consultar as opções do Meta.",
        );
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          toast.error(failure.message);
        }
        return;
      }
      const options = (response?.data ?? response?.options ?? []) as TargetingOption[];
      if (type === "city") setCities(options);
      else if (type === "interest") setInterests(options);
      else setBehaviors(options);
      if (!options.length) {
        setEmptySearch((current) => ({ ...current, [type]: searchedTerm }));
      }
    } catch {
      toast.error("Não foi possível consultar as opções do Meta.");
    } finally {
      setTargetingLoading(null);
    }
  };

  const selectInterestPreset = async (
    queryGroups: readonly (readonly string[])[],
  ) => {
    setTargetingLoading("interest");
    setInterestFocused(false);
    try {
      const resolved = await Promise.all(
        queryGroups.map(async (queries) => {
          const results = await Promise.all(queries.map(async (query) => {
            try {
              const { data: response, error: invokeError } =
                await supabase.functions.invoke("meta-ads-targeting-search", {
                  body: { type: "interest", query },
                });
              if (invokeError || !response?.ok) {
                const failure = await getCampaignError(
                  invokeError,
                  response,
                  "Não foi possível consultar as opções do Meta.",
                );
                if (failure.code === "unauthorized") setSessionExpired(true);
                return [] as TargetingOption[];
              }
              return (response?.data ?? []) as TargetingOption[];
            } catch {
              return [] as TargetingOption[];
            }
          }));
          return closestSafeInterest(results.flat(), queries);
        }),
      );
      setSelectedInterests((current) => {
        const next = [...current];
        const ids = new Set(current.map((item) => item.id));
        resolved.forEach((item) => {
          if (item && !ids.has(item.id)) {
            ids.add(item.id);
            next.push(item);
          }
        });
        return next;
      });
    } finally {
      setTargetingLoading(null);
    }
  };

  useEffect(() => {
    if (step !== 1 || !selectedCity) {
      setAudienceEstimate(null);
      setAudienceEstimateLoading(false);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(async () => {
      setAudienceEstimateLoading(true);
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-targeting-search", {
          body: {
            type: "reach_estimate",
            cities: [selectedCity],
            interests: selectedInterests,
            behaviors: selectedBehaviors,
            radius_km: Number(radiusKm),
            age_min: Number(ageMin),
            age_max: Number(ageMax),
            gender,
          },
        });
      if (!active) return;
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível calcular o público.",
        );
        if (failure.code === "unauthorized") setSessionExpired(true);
        setAudienceEstimate(null);
        setAudienceEstimateLoading(false);
        return;
      }
      if (
        response?.available &&
        Number.isFinite(response.audience_size_lower_bound) &&
        Number.isFinite(response.audience_size_upper_bound)
      ) {
        setAudienceEstimate({
          audience_size_lower_bound: response.audience_size_lower_bound,
          audience_size_upper_bound: response.audience_size_upper_bound,
        });
      } else {
        setAudienceEstimate(null);
      }
      setAudienceEstimateLoading(false);
    }, 700);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    step,
    selectedCity,
    selectedInterests,
    selectedBehaviors,
    radiusKm,
    ageMin,
    ageMax,
    gender,
  ]);

  useEffect(() => {
    if (step !== 2) return;
    let active = true;
    const loadAvailability = async () => {
      setMonthlyAvailabilityLoading(true);
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-draft", {
          body: { action: "availability" },
        });
      if (!active) return;
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível consultar o limite mensal.",
        );
        setMonthlyAvailability(null);
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          setActionError(failure);
        }
      } else {
        setMonthlyAvailability({
          monthly_cap: Number(response.monthly_cap || 0),
          spent: Number(response.spent || 0),
          available: Number(response.available || 0),
        });
      }
      setMonthlyAvailabilityLoading(false);
    };
    void loadAvailability();
    return () => {
      active = false;
    };
  }, [step]);

  const campaignPayload = (copy?: { title: string; text: string }) => ({
    name: copy?.title || draft?.title ||
      `Campanha ${selectedCity?.name || "Meta Ads"}`,
    objective,
    primary_text: copy?.text || draft?.text || selectedMedia?.legenda_gerada ||
      selectedMedia?.contexto_original || "",
    headline: copy?.title || draft?.title || productTitle.trim() || "",
    media_id: selectedMediaId,
    media_source: selectedMedia?.media_source,
    media_bucket: selectedMedia?.media_bucket,
    media_path: selectedMedia?.media_path,
    media_url: selectedMedia?.midia_url,
    media_type: selectedMedia?.tipo === "video" ? "video" : "image",
    daily_budget: Number(dailyBudget),
    duration_days: Number(durationDays),
    cities: selectedCity ? [selectedCity] : [],
    interests: selectedInterests,
    behaviors: selectedBehaviors,
    destination_url: objective === "site" ? destinationUrl.trim() : undefined,
    radius_km: Number(radiusKm),
    age_min: Number(ageMin),
    age_max: Number(ageMax),
    gender: gender === "all" ? undefined : gender,
    whatsapp_message: objective === "whatsapp" ? whatsappMessage.trim() : undefined,
    special_ad_categories: specialCategory ? [specialCategory] : [],
  });

  const deriveHeadline = (content: string) => {
    const firstGeneratedLine = content
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s#>*_-]+/, "").trim())
      .find(Boolean);
    return (productTitle.trim() || firstGeneratedLine || "")
      .slice(0, 255);
  };

  const generatedCopyUsesOnlyProvidedFacts = (content: string) => {
    const suppliedFacts = [
      productTitle,
      productPrice,
      productLink,
    ].filter(Boolean).join(" ");
    const normalizedFacts = normalizeTargetingName(suppliedFacts);
    const normalizeNumber = (value: string) =>
      value.replace(/[.,](?=\d{1,2}\b)/, ".").replace(/[^\d.]/g, "");
    const suppliedNumbers = new Set(
      (suppliedFacts.match(/\d+(?:[.,]\d+)?/g) ?? []).map(normalizeNumber),
    );
    const inventedNumber = (content.match(/\d+(?:[.,]\d+)?/g) ?? [])
      .map(normalizeNumber)
      .some((number) => !suppliedNumbers.has(number));
    if (inventedNumber) return false;
    const normalizedContent = normalizeTargetingName(content);
    if (
      !productPrice.trim() &&
      /(?:r\$|\breais?\b|\bpreco\s+(?:de|por)\b)/i.test(content)
    ) return false;
    if (
      /\b(?:avaliacao|nota|estrelas?)\b/.test(normalizedContent) &&
      !/\b(?:avaliacao|nota|estrelas?)\b/.test(normalizedFacts)
    ) return false;
    if (
      /\b(?:depoimento|clientes?\s+(?:dizem|afirmam|amam|comprovam))\b/.test(
        normalizedContent,
      ) &&
      !/\b(?:depoimento|clientes?\s+(?:dizem|afirmam|amam|comprovam))\b/.test(
        normalizedFacts,
      )
    ) return false;
    return true;
  };

  const generateDraft = async () => {
    if (!selectedMediaId) {
      toast.error("Selecione uma mídia para o anúncio.");
      return;
    }
    if (!productTitle.trim()) {
      toast.error("Informe o nome do produto ou serviço.");
      return;
    }
    setActionError(null);
    setWizardLoading("draft");
    try {
      const { data: generated, error: generationError } =
        await supabase.functions.invoke(
          "gerar-conteudo-ia",
          {
            body: {
              productTitle,
              productPrice: productPrice.trim() ||
                "não informado; não mencione preço",
              productRating:
                "não informada; não mencione nota, avaliação ou estrelas",
              productLink: productLink.trim() ||
                "não informado; não inclua link",
              productDescription: [
                "REGRA OBRIGATÓRIA: use somente os fatos fornecidos abaixo.",
                "Nunca invente preço, desconto, nota, avaliação, depoimento,",
                "quantidade, porcentagem, prazo ou qualquer número.",
                `Produto ou serviço: ${productTitle.trim()}.`,
                productPrice.trim()
                  ? `Preço informado pelo usuário: ${productPrice.trim()}.`
                  : "Preço não informado: não mencione preço.",
                productLink.trim()
                  ? `Link informado pelo usuário: ${productLink.trim()}.`
                  : "Link não informado: não inclua link.",
              ].join(" "),
              platform: "facebook",
            },
          },
        );
      if (generationError || !generated) {
        const failure = await getCampaignError(
          generationError,
          generated,
          "Não foi possível gerar o texto do anúncio.",
        );
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
          return;
        }
        throw new Error(failure.message);
      }
      const content = typeof generated?.content === "string"
        ? generated.content
        : "";
      if (!content.trim()) throw new Error("A IA não retornou conteúdo.");
      if (!generatedCopyUsesOnlyProvidedFacts(content)) {
        throw new Error(
          "A IA incluiu uma informação que você não forneceu. Nada foi salvo; gere novamente.",
        );
      }
      const copy = { title: deriveHeadline(content), text: content };

      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "meta-ads-draft",
        {
          body: {
            id: serverDraftId ?? draft?.id,
            draft: campaignPayload(copy),
            wizard_state: {
              ...wizardState,
              draft: { id: serverDraftId ?? draft?.id ?? "", ...copy },
            },
          },
        },
      );
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível gerar o rascunho.",
        );
        setActionError(failure);
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          toast.error(failure.message);
        }
        return;
      }
      const result = response.data?.rascunho ?? response.draft ?? response;
      setDraft({
        id: response.data?.id ?? response.campaign_id ?? result.id,
        title: result.headline ?? copy.title,
        text: result.primary_text ?? copy.text,
        preview: result.preview,
      });
      setServerDraftId(response.data?.id ?? response.campaign_id ?? result.id);
      setOfficialPreview(null);
      setPublished(false);
      toast.success("Texto criado e rascunho salvo. Você pode editar.");
    } catch (draftError) {
      toast.error(draftError instanceof Error && draftError.message
        ? draftError.message
        : "Não foi possível gerar o rascunho.");
    } finally {
      setWizardLoading(null);
    }
  };

  const requestPreview = async () => {
    if (!draft) return;
    setActionError(null);
    setWizardLoading("preview");
    try {
      const { data: saved, error: saveError } = await supabase.functions.invoke(
        "meta-ads-draft",
        {
          body: {
            id: serverDraftId ?? draft.id,
            draft: campaignPayload(),
            wizard_state: wizardState,
          },
        },
      );
      if (saveError || !saved?.ok) {
        const failure = await getCampaignError(
          saveError,
          saved,
          "Não foi possível salvar suas alterações.",
        );
        setActionError(failure);
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          toast.error(failure.message);
        }
        return;
      }
      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "meta-ads-preview",
        { body: { draft_id: serverDraftId ?? draft.id } },
      );
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível gerar a prévia.",
        );
        setActionError(failure);
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          toast.error(failure.message);
        }
        return;
      }
      if (!Array.isArray(response.previews) || !response.previews.length) {
        throw new Error("O Meta não retornou uma prévia.");
      }
      setOfficialPreview(response.previews as OfficialPreview[]);
      toast.success("Prévia oficial validada pelo Meta.");
    } catch (previewError) {
      toast.error(previewError instanceof Error && previewError.message
        ? previewError.message
        : "Não foi possível gerar a prévia oficial.");
    } finally {
      setWizardLoading(null);
    }
  };

  const publishCampaign = async () => {
    if (!draft || !officialPreview) return;
    if (!window.confirm(`Publicar esta campanha com limite de ${money(totalBudget)}?`)) return;
    setActionError(null);
    setWizardLoading("publish");
    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "meta-ads-publish",
        {
          body: {
            draft_id: serverDraftId ?? draft.id,
            confirm_publish: true,
          },
        },
      );
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível publicar a campanha.",
        );
        setActionError(failure);
        if (failure.code === "funding_source_required") {
          setPaymentDialogOpen(true);
        }
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
        } else {
          toast.error(failure.message);
        }
        return;
      }
      const graph = response.graph as Record<string, unknown> | undefined;
      const publicationComplete = [
        "campaign_id",
        "adset_id",
        "creative_id",
        "ad_id",
      ].every((key) =>
        typeof graph?.[key] === "string" &&
        (graph[key] as string).trim().length > 0
      );
      if (!publicationComplete) {
        const failure = {
          code: "incomplete_publish_response",
          message:
            "A Meta não confirmou todos os itens da campanha. Atualize a página antes de tentar novamente.",
        };
        setActionError(failure);
        toast.error(failure.message);
        return;
      }
      setPublished(true);
      setWizardStarted(false);
      setSavedWizard(null);
      if (storageKey) localStorage.removeItem(storageKey);
      setServerDrafts((current) =>
        current.filter((row) => row.id !== (serverDraftId ?? draft.id))
      );
      toast.success("Campanha publicada.");
      await load();
    } catch (publishError) {
      toast.error(publishError instanceof Error && publishError.message
        ? publishError.message
        : "Não foi possível publicar a campanha.");
    } finally {
      setWizardLoading(null);
    }
  };

  const verifyPaymentStatus = useCallback(async (showSuccess = true) => {
    setPaymentOAuthLoading(true);
    try {
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-payment-status", {
          body: {},
        });
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível verificar o pagamento na Meta.",
        );
        if (failure.code === "unauthorized") {
          setSessionExpired(true);
          return null;
        }
        throw new Error(failure.message);
      }
      const status = response as PaymentStatus;
      setPaymentStatus(status);
      if (showSuccess) {
        if (status.payment_configured && status.account_active) {
          toast.success("Forma de pagamento confirmada pela Meta.");
        } else {
          toast.error("A Meta ainda não confirmou uma forma de pagamento ativa.");
        }
      }
      return status;
    } catch (paymentError) {
      toast.error(
        paymentError instanceof Error
          ? paymentError.message
          : "Não foi possível verificar o pagamento na Meta.",
      );
      return null;
    } finally {
      setPaymentOAuthLoading(false);
    }
  }, []);

  const openPaymentAuthorization = async () => {
    let status = paymentStatus;
    if (!status) {
      status = await verifyPaymentStatus(false);
    }
    if (!status) return;
    if (!window.FB || !facebookSdkReady || !status?.account_id) {
      toast.error("O diálogo de pagamento da Meta ainda não está disponível.");
      return;
    }
    setPaymentOAuthLoading(true);
    window.FB.ui({
      method: "ads_payment",
      account_id: status.account_id,
      display: "popup",
    }, () => {
      // The SDK callback only means the dialog closed; Graph is authoritative.
      void verifyPaymentStatus(true);
    });
  };

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-insights", {
          body: {
            period,
            campaign_id: selectedCampaignId,
            refresh,
          },
        });
      if (invokeError) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível carregar os anúncios agora.",
        );
        if (failure.code === "unauthorized") setSessionExpired(true);
        setData(null);
        setError({ ok: false, code: failure.code, message: failure.message });
        return;
      }
      if (!response?.ok) {
        const failure = await getCampaignError(
          null,
          response,
          "Não foi possível carregar os anúncios agora.",
        );
        setData(null);
        if (failure.code === "unauthorized") setSessionExpired(true);
        setError({ ok: false, code: failure.code, message: failure.message });
      } else {
        setData(response as DashboardData);
      }
    } catch {
      setData(null);
      setError({
        ok: false,
        code: "request_failed",
        message: "Não foi possível carregar os anúncios agora.",
      });
    } finally {
      setLoading(false);
    }
  }, [period, selectedCampaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeCampaignStatus = async (
    campaign: DashboardData["campaigns"][number],
    action: "pause" | "activate",
  ) => {
    if (!campaign.platform_id) return;
    const verb = action === "pause" ? "pausar" : "reativar";
    const consequence = action === "pause"
      ? "A entrega será interrompida e deixará de consumir orçamento."
      : "A campanha voltará a entregar e poderá consumir o orçamento restante.";
    if (!window.confirm(
      `Deseja ${verb} “${campaign.name}”?\n\n${consequence}`,
    )) return;
    setCampaignActionLoading(campaign.platform_id);
    try {
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-campaign-action", {
          body: { id: campaign.platform_id, action },
        });
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          `Não foi possível ${verb} a campanha.`,
        );
        if (failure.code === "unauthorized") setSessionExpired(true);
        throw new Error(failure.message);
      }
      toast.success(
        action === "pause" ? "Campanha pausada." : "Campanha reativada.",
      );
      await load(true);
    } catch (campaignError) {
      toast.error(
        campaignError instanceof Error
          ? campaignError.message
          : `Não foi possível ${verb} a campanha.`,
      );
    } finally {
      setCampaignActionLoading(null);
    }
  };

  useEffect(() => {
    let active = true;
    const initialize = () => {
      if (!active || !window.FB) return;
      window.FB.init({ appId: META_APP_ID, version: "v25.0", xfbml: false });
      setFacebookSdkReady(true);
    };
    window.fbAsyncInit = initialize;
    if (window.FB) {
      initialize();
    } else {
      const script = document.createElement("script");
      script.id = META_SDK_ID;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      document.body.appendChild(script);
    }
    return () => {
      active = false;
      delete window.fbAsyncInit;
      document.getElementById(META_SDK_ID)?.remove();
    };
  }, []);

  const selectedCampaign = selectedCampaignId
    ? data?.campaigns.find((campaign) =>
      campaign.graph_id === selectedCampaignId
    ) ?? null
    : null;
  const metrics = data?.summary;
  const cards = metrics
    ? [
      { label: "Gasto", value: money(metrics.spend), icon: DollarSign },
      { label: "Alcance", value: integer(metrics.reach), icon: Users },
      {
        label: "Impressões",
        value: integer(metrics.impressions),
        icon: Eye,
      },
      { label: "Cliques", value: integer(metrics.clicks), icon: MousePointerClick },
      { label: "CTR", value: `${decimal(metrics.ctr)}%`, icon: TrendingUp },
      { label: "CPC", value: money(metrics.cpc), icon: BarChart3 },
      {
        label: "Conversas",
        value: metrics.conversations === null
          ? "—"
          : integer(metrics.conversations),
        icon: MessageCircle,
      },
      {
        label: "Custo por resultado",
        value: metrics.cost_per_result === null
          ? "—"
          : money(metrics.cost_per_result),
        icon: DollarSign,
      },
      ...(metrics.leads === null
        ? []
        : [{ label: "Leads", value: integer(metrics.leads), icon: Users }]),
      ...(metrics.purchases === null
        ? []
        : [{
          label: "Compras",
          value: integer(metrics.purchases),
          icon: TrendingUp,
        }]),
      ...(metrics.roas === null
        ? []
        : [{
          label: "ROAS",
          value: `${decimal(metrics.roas)}x`,
          icon: TrendingUp,
        }]),
    ]
    : [];

  const chartData = (data?.daily ?? []).map((item) => ({
    ...item,
    label: item.date
      ? new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
      : "",
  }));
  const stepBlockReason = step === 0 && objective === "site" &&
      !/^https:\/\/.+/i.test(destinationUrl.trim())
    ? "Informe um endereço de site válido começando com https://."
    : step === 1 && !selectedCity
    ? cityQuery.trim()
      ? "Clique na lupa e escolha a cidade na lista."
      : "Busque e escolha uma cidade para continuar."
    : step === 1 &&
        !(Number(radiusKm) >= 1 && Number(radiusKm) <= 80)
    ? "Informe um raio entre 1 e 80 km."
    : step === 1 &&
        (!(Number(ageMin) >= 18) || !(Number(ageMin) <= 65) ||
          !(Number(ageMax) >= 18) || !(Number(ageMax) <= 65) ||
          Number(ageMin) > Number(ageMax))
    ? "Informe idades entre 18 e 65 anos, com a mínima menor que a máxima."
    : step === 2 && !(Number(dailyBudget) > 0)
    ? "Informe um orçamento diário maior que zero."
    : step === 2 &&
        (!(Number(durationDays) >= 1) || !(Number(durationDays) <= 365))
    ? "Informe uma duração entre 1 e 365 dias."
    : step === 2 && monthlyAvailabilityLoading
    ? "Aguarde a consulta do limite mensal."
    : step === 2 && !monthlyAvailability
    ? "Consulte o limite mensal para continuar."
    : step === 2 && exceedsMonthlyAvailability
    ? `Reduza o orçamento para até ${money(suggestedDailyBudget)} por dia.`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-2 -ml-3"
              onClick={() => leavePage("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Anúncios Meta
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie e acompanhe seus anúncios da conta{" "}
              {data?.account.name || data?.account.id || "selecionada"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={openWizard}>
              <Plus className="w-4 h-4 mr-2" />
              Criar campanha
            </Button>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              {PERIODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => void load(true)}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>

        {sessionExpired && (
          <div className="flex flex-col gap-3 rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">Sua sessão expirou. Entre novamente.</p>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Ir para o login
            </Button>
          </div>
        )}

        {showWizard && (
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Nova campanha</CardTitle>
                <Button variant="ghost" onClick={closeWizard}>
                  Fechar
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {STEPS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => index <= step && setStep(index)}
                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                      index === step
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950"
                        : index < step
                          ? "border-green-500 text-green-700"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span className="mr-2 font-semibold">
                      {index < step ? <Check className="inline h-4 w-4" /> : index + 1}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 0 && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="campaign-objective">Para onde o anúncio leva?</Label>
                    <select
                      id="campaign-objective"
                      value={objective}
                      onChange={(event) => {
                        setObjective(event.target.value as CampaignObjective);
                        setDraft(null);
                        setOfficialPreview(null);
                        setActionError(null);
                      }}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="whatsapp">Conversa no WhatsApp</option>
                      <option value="site">Página do meu site</option>
                    </select>
                  </div>

                  {objective === "whatsapp" ? (
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp-message">Mensagem pronta do WhatsApp</Label>
                      <Textarea
                        id="whatsapp-message"
                        rows={3}
                        maxLength={1000}
                        value={whatsappMessage}
                        onChange={(event) => setWhatsappMessage(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        A pessoa pode editar a mensagem antes de enviar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="destination-url">Endereço da página</Label>
                      <Input
                        id="destination-url"
                        type="url"
                        value={destinationUrl}
                        onChange={(event) => setDestinationUrl(event.target.value)}
                        placeholder="https://seusite.com/oferta"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="special-category">Este anúncio é sobre algum tema especial?</Label>
                    <select
                      id="special-category"
                      value={specialCategory}
                      onChange={(event) => setSpecialCategory(event.target.value as SpecialCategory)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Não</option>
                      <option value="CREDIT">Crédito</option>
                      <option value="EMPLOYMENT">Emprego</option>
                      <option value="HOUSING">Moradia</option>
                      <option value="ISSUES_ELECTIONS_POLITICS">Política ou eleições</option>
                      <option value="FINANCIAL_PRODUCTS_SERVICES">Produtos e serviços financeiros</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Se o anúncio tratar de um desses temas, escolha a opção correta.
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-3">
                    <Label htmlFor="city-search">Cidade</Label>
                    <div className="flex gap-2">
                      <Input
                        id="city-search"
                        value={cityQuery}
                        onChange={(event) => {
                          setCityQuery(event.target.value);
                          setSelectedCity(null);
                          setEmptySearch((current) => ({ ...current, city: undefined }));
                        }}
                        onKeyDown={(event) => event.key === "Enter" && searchTargeting("city")}
                        placeholder="Ex.: São Paulo"
                      />
                      <Button variant="outline" onClick={() => searchTargeting("city")}>
                        {targetingLoading === "city"
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    {selectedCity && (
                      <Badge variant="secondary">{selectedCity.name}</Badge>
                    )}
                    <div className="space-y-1">
                      {cities.map((city) => (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => {
                            setSelectedCity(city);
                            setCityQuery(city.name);
                            setCities([]);
                          }}
                          className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {city.name}
                        </button>
                      ))}
                      {emptySearch.city && (
                        <p className="text-sm text-muted-foreground">
                          Nenhum resultado para '{emptySearch.city}'. Tente outra palavra.
                        </p>
                      )}
                      {cityQuery.trim() && !selectedCity && (
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Clique na lupa e escolha a cidade na lista.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="interest-search">Interesses</Label>
                    <div className="flex gap-2">
                      <Input
                        id="interest-search"
                        value={interestQuery}
                        onFocus={() => setInterestFocused(true)}
                        onBlur={() => setInterestFocused(false)}
                        onChange={(event) => {
                          setInterestQuery(event.target.value);
                          setEmptySearch((current) => ({
                            ...current,
                            interest: undefined,
                          }));
                        }}
                        onKeyDown={(event) => event.key === "Enter" && searchTargeting("interest")}
                        placeholder="Ex.: marketing digital"
                      />
                      <Button variant="outline" onClick={() => searchTargeting("interest")}>
                        {targetingLoading === "interest"
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedInterests.map((interest) => (
                        <button
                          key={interest.id}
                          type="button"
                          onClick={() => setSelectedInterests((items) =>
                            items.filter((item) => item.id !== interest.id))}
                        >
                          <Badge variant="secondary">
                            {interest.name}
                            {audienceRange(interest)
                              ? ` (${audienceRange(interest)})`
                              : ""} ×
                          </Badge>
                        </button>
                      ))}
                    </div>
                    {interestFocused && !interestQuery.trim() && (
                      <div className="space-y-2 rounded-md border p-3">
                        {INTEREST_PRESETS.map((group) => (
                          <button
                            key={group.name}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void selectInterestPreset(group.queries)}
                            className="block w-full rounded border px-3 py-2 text-left hover:bg-muted"
                          >
                            <span className="block text-sm font-medium">{group.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {group.queries.map((queries) => queries.join(" / ")).join(", ")}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1">
                      {interests.map((interest) => (
                        <button
                          key={interest.id}
                          type="button"
                          onClick={() => {
                            setSelectedInterests((items) =>
                              items.some((item) => item.id === interest.id)
                                ? items
                                : [...items, interest]);
                            setInterests([]);
                            setInterestQuery("");
                          }}
                          className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="block">{interest.name}</span>
                          {audienceRange(interest) && (
                            <span className="text-xs text-muted-foreground">
                              {audienceRange(interest)}
                            </span>
                          )}
                        </button>
                      ))}
                      {emptySearch.interest && (
                        <p className="text-sm text-muted-foreground">
                          Nenhum resultado para '{emptySearch.interest}'. Tente outra palavra.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="behavior-search">Comportamentos</Label>
                    <div className="flex gap-2">
                      <Input
                        id="behavior-search"
                        value={behaviorQuery}
                        onChange={(event) => {
                          setBehaviorQuery(event.target.value);
                          setEmptySearch((current) => ({
                            ...current,
                            behavior: undefined,
                          }));
                        }}
                        onKeyDown={(event) =>
                          event.key === "Enter" && searchTargeting("behavior")}
                        placeholder="Ex.: compradores envolvidos"
                      />
                      <Button variant="outline" onClick={() => searchTargeting("behavior")}>
                        {targetingLoading === "behavior"
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedBehaviors.map((behavior) => (
                        <button
                          key={behavior.id}
                          type="button"
                          onClick={() => setSelectedBehaviors((items) =>
                            items.filter((item) => item.id !== behavior.id))}
                        >
                          <Badge variant="secondary">
                            {behavior.name} · comportamento
                            {audienceRange(behavior)
                              ? ` (${audienceRange(behavior)})`
                              : ""} ×
                          </Badge>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {behaviors.map((behavior) => (
                        <button
                          key={behavior.id}
                          type="button"
                          onClick={() => {
                            setSelectedBehaviors((items) =>
                              items.some((item) => item.id === behavior.id)
                                ? items
                                : [...items, behavior]);
                            setBehaviors([]);
                            setBehaviorQuery("");
                          }}
                          className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="block">{behavior.name} · comportamento</span>
                          {audienceRange(behavior) && (
                            <span className="text-xs text-muted-foreground">
                              {audienceRange(behavior)}
                            </span>
                          )}
                        </button>
                      ))}
                      {emptySearch.behavior && (
                        <p className="text-sm text-muted-foreground">
                          Nenhum resultado para '{emptySearch.behavior}'. Tente outra palavra.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 rounded-md border p-4 md:col-span-3 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="radius-km">Raio da cidade (km)</Label>
                      <Input
                        id="radius-km"
                        type="number"
                        min="1"
                        max="80"
                        value={radiusKm}
                        onChange={(event) => setRadiusKm(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age-min">Idade mínima</Label>
                      <Input
                        id="age-min"
                        type="number"
                        min="18"
                        max="65"
                        value={ageMin}
                        onChange={(event) => setAgeMin(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age-max">Idade máxima</Label>
                      <Input
                        id="age-max"
                        type="number"
                        min="18"
                        max="65"
                        value={ageMax}
                        onChange={(event) => setAgeMax(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="audience-gender">Gênero</Label>
                      <select
                        id="audience-gender"
                        value={gender}
                        onChange={(event) => setGender(event.target.value as Gender)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <option value="all">Todos</option>
                        <option value="female">Mulheres</option>
                        <option value="male">Homens</option>
                      </select>
                    </div>
                    {selectedCity && (
                      <div className="rounded-md bg-muted p-3 md:col-span-4">
                        <p className="text-sm font-medium">Público estimado</p>
                        <p className="text-sm text-muted-foreground">
                          {audienceEstimateLoading
                            ? "Calculando com dados do Meta..."
                            : audienceEstimate
                            ? `${
                              integer(audienceEstimate.audience_size_lower_bound)
                            }–${
                              integer(audienceEstimate.audience_size_upper_bound)
                            } pessoas`
                            : "Estimativa indisponível no Meta para este público."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="daily-budget">Orçamento diário (R$)</Label>
                    <Input
                      id="daily-budget"
                      type="number"
                      min="1"
                      step="0.01"
                      value={dailyBudget}
                      onChange={(event) => setDailyBudget(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration-days">Duração (dias)</Label>
                    <Input
                      id="duration-days"
                      type="number"
                      min="1"
                      max="365"
                      value={durationDays}
                      onChange={(event) => setDurationDays(event.target.value)}
                    />
                  </div>
                  <div
                    className={`rounded-md border p-4 md:col-span-2 ${
                      exceedsMonthlyAvailability
                        ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"
                        : "border-transparent bg-muted"
                    }`}
                  >
                    {monthlyAvailabilityLoading ? (
                      <p className="mb-3 text-sm text-muted-foreground">
                        Consultando limite mensal...
                      </p>
                    ) : monthlyAvailability && (
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p
                          className={`text-sm ${
                            exceedsMonthlyAvailability
                              ? "font-medium text-red-700 dark:text-red-300"
                              : "text-muted-foreground"
                          }`}
                        >
                          Limite do mês: {money(monthlyAvailability.monthly_cap)}
                          {" · "}Já gasto neste mês: {money(monthlyAvailability.spent)}
                          {" · "}Ainda cabe: {money(monthlyAvailability.available)}
                        </p>
                        <Button
                          variant="link"
                          className="h-auto justify-start p-0"
                          onClick={() => navigate("/configuracoes")}
                        >
                          Alterar limite
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">Gasto máximo desta campanha</p>
                    <p
                      className={`text-2xl font-bold ${
                        exceedsMonthlyAvailability
                          ? "text-red-700 dark:text-red-300"
                          : ""
                      }`}
                    >
                      {money(totalBudget)}
                    </p>
                    {exceedsMonthlyAvailability && (
                      <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">
                        Para caber no mês, use até {money(suggestedDailyBudget)} por dia.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  {selectedMedia ? (
                    <div className="space-y-3 rounded-lg border p-4">
                      <p className="font-medium text-green-700 dark:text-green-300">
                        ✅ Mídia selecionada
                      </p>
                      {selectedMedia.tipo === "video"
                        ? (
                          <video
                            src={selectedMedia.midia_url}
                            className="max-h-[32rem] w-full rounded-lg bg-black object-contain"
                            autoPlay
                            loop
                            muted
                            playsInline
                            controls
                          />
                        )
                        : (
                          <img
                            src={selectedMedia.midia_url}
                            alt={selectedMedia.display_name}
                            className="max-h-[32rem] w-full rounded-lg object-contain"
                          />
                        )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedMedia(null);
                          setOfficialPreview(null);
                        }}
                      >
                        Trocar mídia
                      </Button>
                    </div>
                  ) : (
                    <MediaPicker
                      selectedId={selectedMediaId}
                      onSelect={(item) => {
                        setSelectedMedia(item);
                        setOfficialPreview(null);
                      }}
                    />
                  )}

                  <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="product-title">Produto ou serviço</Label>
                      <Input
                        id="product-title"
                        value={productTitle}
                        onChange={(event) => setProductTitle(event.target.value)}
                        placeholder="Ex.: Consultoria de marketing"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-price">Preço (opcional)</Label>
                      <Input
                        id="product-price"
                        value={productPrice}
                        onChange={(event) => setProductPrice(event.target.value)}
                        placeholder="Ex.: R$ 99,90"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-link">
                        Link do produto ou serviço (opcional)
                      </Label>
                      <Input
                        id="product-link"
                        type="url"
                        value={productLink}
                        onChange={(event) => setProductLink(event.target.value)}
                        placeholder="https://seusite.com/produto"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="ad-title">Título do anúncio</Label>
                        <Input
                          id="ad-title"
                          value={draft?.title ?? ""}
                          onChange={(event) => {
                            setDraft({
                              id: draft?.id ?? serverDraftId ?? "",
                              title: event.target.value,
                              text: draft?.text ?? "",
                            });
                            setOfficialPreview(null);
                          }}
                          placeholder="Escreva ou cole o título"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ad-text">Texto principal</Label>
                        <Textarea
                          id="ad-text"
                          rows={6}
                          value={draft?.text ?? ""}
                          onChange={(event) => {
                            setDraft({
                              id: draft?.id ?? serverDraftId ?? "",
                              title: draft?.title ?? "",
                              text: event.target.value,
                            });
                            setOfficialPreview(null);
                          }}
                          placeholder="Escreva ou cole o texto principal"
                        />
                      </div>
                    <Button
                      variant="outline"
                      onClick={generateDraft}
                      disabled={!selectedMediaId || !productTitle.trim() ||
                        !serverDraftId || !!wizardLoading}
                    >
                      {(wizardLoading === "draft" || !serverDraftId) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {serverDraftId
                        ? draft
                          ? "Gerar outra sugestão com IA"
                          : "Gerar título e texto com IA (opcional)"
                        : "Salvando rascunho..."}
                    </Button>
                    </div>
                    {draft?.title.trim() && draft.text.trim() && (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-background p-4">
                          {selectedMedia && (
                            selectedMedia.tipo === "video"
                              ? <video src={selectedMedia.midia_url} controls className="mb-3 w-full rounded" />
                              : <img src={selectedMedia.midia_url} alt="" className="mb-3 w-full rounded" />
                          )}
                          <p className="font-semibold">{draft.title}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{draft.text}</p>
                        </div>
                        <Button onClick={requestPreview} disabled={!!wizardLoading}>
                          {wizardLoading === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Gerar prévia oficial
                        </Button>
                        {officialPreview && (
                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              {officialPreview.map((preview) => (
                                <div key={preview.placement} className="overflow-hidden rounded-md border bg-white">
                                  <p className="border-b px-3 py-2 text-xs font-medium uppercase text-gray-600">
                                    {preview.placement}
                                  </p>
                                  <iframe
                                    title={`Prévia oficial — ${preview.placement}`}
                                    srcDoc={preview.body}
                                    sandbox="allow-scripts allow-popups"
                                    className="h-80 w-full"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="space-y-3 rounded-md border border-green-500 bg-green-50 p-4 dark:bg-green-950">
                            <p className="font-medium text-green-800 dark:text-green-200">
                              <Check className="mr-2 inline h-4 w-4" />
                              Prévia gerada. Confira acima se a Meta não mostrou nenhum aviso antes de publicar.
                            </p>
                            <Button onClick={publishCampaign} disabled={!!wizardLoading || published}>
                              {wizardLoading === "publish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {published ? "Campanha publicada" : "Confirmar e publicar"}
                            </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actionError && (
                <div className="space-y-3 rounded-md border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    {actionError.message}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {actionError.code === "whatsapp_not_ready" && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setObjective("site");
                          setActionError(null);
                          setOfficialPreview(null);
                          setStep(0);
                        }}
                      >
                        Usar uma página do site
                      </Button>
                    )}
                    {[
                      "not_connected",
                      "meta_ads_not_ready",
                      "facebook_page_not_ready",
                      "token_expired",
                    ].includes(actionError.code) && (
                      <Button variant="outline" onClick={() => navigate("/configuracoes")}>
                        Abrir configurações
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row">
                <div className="flex flex-wrap gap-2">
                  <Button variant="link" className="px-0" onClick={() => navigate("/planos")}>
                    Pagamentos <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                  <Button variant="link" onClick={() => navigate("/configuracoes")}>
                    Página e conta Meta <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                  <Button variant="link" onClick={() => navigate("/whatsapp")}>
                    WhatsApp <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {stepBlockReason && (
                    <p className="w-full text-right text-sm font-medium text-amber-700 dark:text-amber-300">
                      {stepBlockReason}
                    </p>
                  )}
                  <Button variant="outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
                    Voltar
                  </Button>
                  {step < STEPS.length - 1 && (
                    <Button
                      onClick={() => setStep((value) => value + 1)}
                      disabled={Boolean(stepBlockReason)}
                    >
                      Continuar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rascunhos</CardTitle>
          </CardHeader>
          <CardContent>
            {serverDraftsLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando rascunhos...
              </p>
            ) : serverDrafts.length ? (
              <div className="space-y-3">
                {serverDrafts.map((row) => {
                  const storedState = row.rascunho?.wizard_state &&
                      typeof row.rascunho.wizard_state === "object"
                    ? row.rascunho.wizard_state as Partial<WizardAutosave>
                    : null;
                  const name = String(
                    row.rascunho?.headline ??
                      storedState?.draft?.title ??
                      storedState?.productTitle ??
                      row.rascunho?.name ??
                      "Campanha sem nome",
                  );
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{name}</p>
                        <p className="text-sm text-muted-foreground">
                          Orçamento máximo: {money(row.gasto_maximo)}
                          {" · "}
                          Atualizado em{" "}
                          {new Date(row.atualizado_em).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => continueServerDraft(row)}
                        >
                          Continuar editando
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void deleteServerDraft(row)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum rascunho salvo na conta.
              </p>
            )}
          </CardContent>
        </Card>

        <Dialog open={resumePromptOpen} onOpenChange={setResumePromptOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Você tem uma campanha em andamento</DialogTitle>
              <DialogDescription>
                Continue de onde parou ou comece uma nova campanha.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button
                variant="outline"
                onClick={() => startNewWizard(true)}
              >
                Começar nova
              </Button>
              <Button
                onClick={() => savedWizard && applyWizardState(savedWizard)}
                disabled={!savedWizard}
              >
                Continuar de onde parei
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Autorizar pagamento de anúncios</DialogTitle>
              <DialogDescription>
                A conta de anúncios precisa de autorização para consultar e
                configurar a forma de pagamento antes da publicação.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:space-x-0">
              {(paymentStatus?.billing_url || actionError?.billingUrl) && (
                <Button variant="outline" asChild>
                  <a
                    href={paymentStatus?.billing_url || actionError?.billingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Plano B: abrir cobrança no Ads Manager
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => void verifyPaymentStatus(true)}
                disabled={paymentOAuthLoading}
              >
                Já cadastrei, verificar
              </Button>
              <Button
                onClick={() => void openPaymentAuthorization()}
                disabled={paymentOAuthLoading || !facebookSdkReady}
              >
                {paymentOAuthLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Cadastrar pagamento com a Meta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <Card>
            <CardContent className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando métricas...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="font-medium">{error.message}</p>
              {[
                "not_connected",
                "account_not_selected",
                "token_expired",
                "permission",
              ].includes(error.code) && (
                <Button onClick={() => navigate("/configuracoes")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Ir para Configurações
                </Button>
              )}
            </CardContent>
          </Card>
        ) : data && !data.has_data ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-lg font-semibold">Nenhum anúncio no período</p>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione outro período para consultar.
              </p>
            </CardContent>
          </Card>
        ) : data && metrics ? (
          <>
            {selectedCampaign && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Métricas da campanha
                    </p>
                    <p className="font-semibold">{selectedCampaign.name}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCampaignId(null)}
                  >
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {cards.map((card) => (
                <Card key={card.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {card.label}
                      </p>
                      <card.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold mt-2">{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  Gasto x conversas por dia
                  {selectedCampaign ? ` — ${selectedCampaign.name}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis
                          yAxisId="money"
                          tickFormatter={(value) => `R$ ${value}`}
                        />
                        <YAxis
                          yAxisId="results"
                          orientation="right"
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) =>
                            name === "Gasto"
                              ? [money(value), name]
                              : [integer(value), name]}
                        />
                        <Legend />
                        <Line
                          yAxisId="money"
                          type="monotone"
                          dataKey="spend"
                          name="Gasto"
                          stroke="#2563eb"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="results"
                          type="monotone"
                          dataKey="conversations"
                          name="Conversas"
                          stroke="#16a34a"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-muted-foreground">
                    Sem série diária para este período.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campanhas</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.campaigns.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-3 pr-4">Campanha</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4 text-right">Gasto</th>
                        <th className="py-3 pr-4 text-right">Cliques</th>
                        <th className="py-3 pr-4 text-right">CTR</th>
                        <th className="py-3 pr-4 text-right">CPC</th>
                        <th className="py-3 pr-4 text-right">Resultados</th>
                        <th className="py-3 pr-4 text-right">Custo/resultado</th>
                        <th className="py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((campaign) => (
                        <tr
                          key={campaign.id}
                          className={`border-b last:border-0 ${
                            selectedCampaignId === campaign.graph_id
                              ? "bg-muted/60"
                              : ""
                          }`}
                        >
                          <td className="py-3 pr-4 font-medium">
                            {campaign.graph_id ? (
                              <button
                                type="button"
                                className="text-left text-blue-700 hover:underline dark:text-blue-300"
                                onClick={() =>
                                  setSelectedCampaignId(campaign.graph_id)}
                              >
                                {campaign.name}
                              </button>
                            ) : campaign.name}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              <Badge
                                variant={campaign.status === "ACTIVE"
                                  ? "default"
                                  : campaign.status === "ERROR"
                                  ? "destructive"
                                  : "secondary"}
                              >
                                {STATUS_LABELS[campaign.status] ||
                                  campaign.status}
                              </Badge>
                              {campaign.source === "meta" && (
                                <Badge variant="outline">Criada na Meta</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {money(campaign.spend)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {integer(campaign.clicks)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {decimal(campaign.ctr)}%
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {money(campaign.cpc)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {campaign.results === null
                              ? "—"
                              : integer(campaign.results)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {campaign.cost_per_result === null
                              ? "—"
                              : money(campaign.cost_per_result)}
                          </td>
                          <td className="py-3 text-right">
                            {campaign.source === "platform" &&
                                campaign.platform_id &&
                                campaign.graph_id &&
                                ["ACTIVE", "PAUSED"].includes(campaign.status)
                              ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={campaignActionLoading ===
                                    campaign.platform_id}
                                  onClick={() =>
                                    void changeCampaignStatus(
                                      campaign,
                                      campaign.status === "ACTIVE"
                                        ? "pause"
                                        : "activate",
                                    )}
                                >
                                  {campaignActionLoading ===
                                      campaign.platform_id
                                    ? (
                                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    )
                                    : campaign.status === "ACTIVE"
                                    ? <Pause className="mr-1 h-3.5 w-3.5" />
                                    : <Play className="mr-1 h-3.5 w-3.5" />}
                                  {campaign.status === "ACTIVE"
                                    ? "Pausar"
                                    : "Reativar"}
                                </Button>
                              )
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhuma campanha encontrada.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
