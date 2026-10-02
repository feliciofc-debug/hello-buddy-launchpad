import { useCallback, useEffect, useState } from "react";
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
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
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
    queries: [["Varejo"], ["Compras"], ["Moda"], ["Restaurantes"]],
  },
  {
    name: "Beleza e estética",
    queries: [["Salão de beleza"], ["Estética"], ["Cosméticos"]],
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

const editDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};

const closestSafeInterest = (
  options: TargetingOption[],
  queries: readonly string[],
) => {
  const normalizedQueries = queries.map(normalizeTargetingName);
  return options
    .filter((option) => {
      const name = normalizeTargetingName(option.name);
      return !UNSAFE_PRESET_TERMS.some((term) => name.includes(term));
    })
    .map((option) => {
      const name = normalizeTargetingName(option.name);
      const score = Math.min(...normalizedQueries.map((query) =>
        name === query
          ? 0
          : name.startsWith(query)
          ? 10 + Math.abs(name.length - query.length)
          : name.includes(query)
          ? 20 + Math.abs(name.length - query.length)
          : 100 + editDistance(name, query)
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
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<CampaignObjective>("whatsapp");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState(
    "Olá! Vi seu anúncio e gostaria de saber mais.",
  );
  const [radiusKm, setRadiusKm] = useState("25");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [gender, setGender] = useState<Gender>("all");
  const [specialCategory, setSpecialCategory] = useState<SpecialCategory>("");
  const [selectedMedia, setSelectedMedia] = useState<MetaAdsMedia | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productRating, setProductRating] = useState("");
  const [productLink, setProductLink] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [interestQuery, setInterestQuery] = useState("");
  const [behaviorQuery, setBehaviorQuery] = useState("");
  const [cities, setCities] = useState<TargetingOption[]>([]);
  const [interests, setInterests] = useState<TargetingOption[]>([]);
  const [interestSuggestions, setInterestSuggestions] = useState<TargetingOption[]>([]);
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

  const openWizard = () => {
    setShowWizard(true);
  };

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
    const interestList = selectedInterests.map((item) => item.id);
    if (!interestList.length) {
      setInterestSuggestions([]);
      return;
    }
    let active = true;
    void supabase.functions.invoke("meta-ads-targeting-search", {
      body: { type: "interest_suggestion", interest_list: interestList },
    }).then(async ({ data: response, error: invokeError }) => {
      if (!active) return;
      if (invokeError || !response?.ok) {
        const failure = await getCampaignError(
          invokeError,
          response,
          "Não foi possível consultar as sugestões do Meta.",
        );
        if (active && failure.code === "unauthorized") setSessionExpired(true);
        return;
      }
      const selected = new Set(interestList);
      const suggestions = ((response?.data ?? []) as TargetingOption[])
        .filter((item) => !selected.has(item.id));
      setInterestSuggestions(suggestions);
    });
    return () => {
      active = false;
    };
  }, [selectedInterests]);

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
      selectedMedia?.contexto_original || "Conheça esta novidade.",
    headline: copy?.title || draft?.title || selectedMedia?.arquivo_nome ||
      "Conheça esta novidade",
    media_id: selectedMediaId,
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
    return (productTitle.trim() || firstGeneratedLine || "Conheça esta novidade")
      .slice(0, 255);
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
              productPrice,
              productRating,
              productLink,
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
      const copy = { title: deriveHeadline(content), text: content };

      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "meta-ads-draft",
        { body: { id: draft?.id, draft: campaignPayload(copy) } },
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
        { body: { id: draft.id, draft: campaignPayload() } },
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
        { body: { draft_id: draft.id } },
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
        { body: { draft_id: draft.id, confirm_publish: true } },
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-insights", {
          body: { period },
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
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-2 -ml-3"
              onClick={() => navigate("/dashboard")}
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
            <Button variant="outline" onClick={load} disabled={loading}>
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
                <Button variant="ghost" onClick={() => setShowWizard(false)}>
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
                    {interestSuggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Sugestões relacionadas do Meta
                        </p>
                        {interestSuggestions.map((interest) => (
                          <button
                            key={interest.id}
                            type="button"
                            onClick={() => {
                              setSelectedInterests((items) =>
                                items.some((item) => item.id === interest.id)
                                  ? items
                                  : [...items, interest]);
                              setInterestSuggestions((items) =>
                                items.filter((item) => item.id !== interest.id));
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
                      </div>
                    )}
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
                  <MediaPicker
                    selectedId={selectedMediaId}
                    onSelect={(item) => {
                      setSelectedMedia(item);
                      setDraft(null);
                      setOfficialPreview(null);
                    }}
                    onOpenWhatsApp={() => navigate("/whatsapp")}
                  />

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
                      <Label htmlFor="product-price">Preço</Label>
                      <Input
                        id="product-price"
                        value={productPrice}
                        onChange={(event) => setProductPrice(event.target.value)}
                        placeholder="Ex.: R$ 99,90"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-rating">Avaliação</Label>
                      <Input
                        id="product-rating"
                        value={productRating}
                        onChange={(event) => setProductRating(event.target.value)}
                        placeholder="Ex.: 4,8"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="product-link">Link do produto ou serviço</Label>
                      <Input
                        id="product-link"
                        type="url"
                        value={productLink}
                        onChange={(event) => setProductLink(event.target.value)}
                        placeholder="https://seusite.com/produto"
                      />
                    </div>
                  </div>

                  {!draft ? (
                    <Button
                      onClick={generateDraft}
                      disabled={!selectedMediaId || !productTitle.trim() ||
                        !!wizardLoading}
                    >
                      {wizardLoading === "draft" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gerar título e texto com IA
                    </Button>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ad-title">Título</Label>
                          <Input
                            id="ad-title"
                            value={draft.title}
                            onChange={(event) => {
                              setDraft({ ...draft, title: event.target.value });
                              setOfficialPreview(null);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ad-text">Texto principal</Label>
                          <Textarea
                            id="ad-text"
                            rows={6}
                            value={draft.text}
                            onChange={(event) => {
                              setDraft({ ...draft, text: event.target.value });
                              setOfficialPreview(null);
                            }}
                          />
                        </div>
                        <Button variant="outline" onClick={generateDraft} disabled={!!wizardLoading}>
                          Gerar outra sugestão
                        </Button>
                      </div>
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
                              Prévia oficial pronta. Revise e publique explicitamente.
                            </p>
                            <Button onClick={publishCampaign} disabled={!!wizardLoading || published}>
                              {wizardLoading === "publish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {published ? "Campanha publicada" : "Confirmar e publicar"}
                            </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
                    Voltar
                  </Button>
                  {step < STEPS.length - 1 && (
                    <Button
                      onClick={() => setStep((value) => value + 1)}
                      disabled={(step === 0 && objective === "site" &&
                        !/^https:\/\/.+/i.test(destinationUrl.trim())) ||
                        (step === 1 && (!selectedCity ||
                          !(Number(radiusKm) >= 1 && Number(radiusKm) <= 80) ||
                          !(Number(ageMin) >= 18 && Number(ageMax) <= 65) ||
                          Number(ageMin) > Number(ageMax))) ||
                        (step === 2 && (
                          !(Number(dailyBudget) > 0) ||
                          !(Number(durationDays) > 0) ||
                          monthlyAvailabilityLoading ||
                          !monthlyAvailability ||
                          exceedsMonthlyAvailability
                        ))}
                    >
                      Continuar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                <CardTitle>Gasto x conversas por dia</CardTitle>
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
                        <th className="py-3 text-right">Custo/resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">
                            {campaign.name}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={campaign.status === "ACTIVE"
                                ? "default"
                                : "secondary"}
                            >
                              {STATUS_LABELS[campaign.status] || campaign.status}
                            </Badge>
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
                          <td className="py-3 text-right">
                            {campaign.cost_per_result === null
                              ? "—"
                              : money(campaign.cost_per_result)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhuma campanha com entrega no período.
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
