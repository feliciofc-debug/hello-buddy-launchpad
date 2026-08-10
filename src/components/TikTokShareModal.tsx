import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Video, Image, ExternalLink, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { buildTikTokAuthUrl } from "@/config/tiktok";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TikTokShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: {
    type: "image" | "video";
    url: string;
    title?: string;
    description?: string;
  };
}

interface CreatorInfo {
  creator_avatar_url: string | null;
  creator_username: string | null;
  creator_nickname: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number | null;
}

export const TikTokShareModal = ({ open, onOpenChange, content }: TikTokShareModalProps) => {
  const { t, i18n } = useTranslation();
  const isEnglish = (i18n.language || "").toLowerCase().startsWith("en");

  const PRIVACY_LABELS = useMemo<Record<string, string>>(() => ({
    PUBLIC_TO_EVERYONE: t("tiktok_share.privacy_public"),
    MUTUAL_FOLLOW_FRIENDS: t("tiktok_share.privacy_friends"),
    FOLLOWER_OF_CREATOR: t("tiktok_share.privacy_followers"),
    SELF_ONLY: t("tiktok_share.privacy_self"),
  }), [t]);

  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [postMode, setPostMode] = useState<"direct" | "draft">("draft");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Creator info (nunca cacheado — buscado a cada abertura)
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [creatorError, setCreatorError] = useState<string>("");

  // Escolhas de compliance
  const [privacyLevel, setPrivacyLevel] = useState<string>("");
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [commercialContent, setCommercialContent] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);

  // Duração medida do vídeo (pode ser inválida em WebM do MediaRecorder)
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  type PostStatus = "idle" | "uploading" | "processing" | "done" | "failed";
  const [postStatus, setPostStatus] = useState<PostStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [failReason, setFailReason] = useState<string>("");
  const [attempts, setAttempts] = useState(0);

  const pollTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const clearTimers = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!open) {
      clearTimers();
      setPostStatus("idle");
      setStatusMessage("");
      setFailReason("");
      setAttempts(0);
      setCreator(null);
      setCreatorError("");
      setPrivacyLevel("");
      setAllowComment(true);
      setAllowDuet(true);
      setAllowStitch(true);
      setCommercialContent(false);
      setBrandOrganic(false);
      setBrandedContent(false);
      setVideoDuration(null);
      return;
    }

    cancelledRef.current = false;
    checkTikTokConnection();
    if (content.title) {
      setCaption(`${content.title}\n\n🔥 Confira essa oferta incrível!\n\n#tiktok #ofertas #promocao #fyp #viral`);
    }
  }, [open, content.title, clearTimers]);

  // Medir duração do vídeo com <video> oculto (+ timeout de 5s)
  useEffect(() => {
    if (!open || content.type !== "video" || !content.url) return;

    let settled = false;
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      setVideoDuration(value);
      el.src = "";
    };

    const timeout = window.setTimeout(() => {
      console.warn("⏱️ Metadados do vídeo não carregaram em 5s — validação de duração ignorada.");
      finish(null);
    }, 5000);

    el.onloadedmetadata = () => {
      const d = el.duration;
      const duracaoValida = Number.isFinite(d) && d > 0;
      if (!duracaoValida) {
        console.warn("⚠️ Duração do vídeo inválida (provável WebM do MediaRecorder) — validação ignorada.");
        finish(null);
        return;
      }
      finish(d);
    };
    el.onerror = () => {
      console.warn("⚠️ Não foi possível ler os metadados do vídeo — validação de duração ignorada.");
      finish(null);
    };

    el.src = content.url;

    return () => finish(null);
  }, [open, content.type, content.url]);

  const MAX_ATTEMPTS = 40;

  const loadCreatorInfo = async (userId: string) => {
    setLoadingCreator(true);
    setCreatorError("");
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-creator-info", {
        body: { user_id: userId },
      });
      if (error) throw error;

      if (!data?.success) {
        setCreator(null);
        setCreatorError(
          data?.error === "token_expired"
            ? t("tiktok_share.err_token_expired")
            : data?.error === "not_connected"
              ? t("tiktok_share.err_not_connected")
              : data?.error || t("tiktok_share.err_creator_info")
        );
        return;
      }

      setCreator(data as CreatorInfo);
      // Sem default: o usuário precisa escolher a privacidade.
      setPrivacyLevel("");
      if (data.comment_disabled) setAllowComment(false);
      if (data.duet_disabled) setAllowDuet(false);
      if (data.stitch_disabled) setAllowStitch(false);
    } catch (e: any) {
      console.error("Erro ao carregar creator info:", e);
      setCreator(null);
      setCreatorError(e?.message || t("tiktok_share.err_creator_info"));
    } finally {
      setLoadingCreator(false);
    }
  };

  const startPolling = (userId: string, publishId: string) => {
    let attempt = 0;

    const tick = async () => {
      if (cancelledRef.current) return;
      attempt += 1;
      setAttempts(attempt);

      try {
        const { data, error } = await supabase.functions.invoke("tiktok-post-status", {
          body: { user_id: userId, publish_id: publishId },
        });

        if (cancelledRef.current) return;

        if (!error && data?.success) {
          const status: string = data.status;

          if (status === "PUBLISH_COMPLETE") {
            setPostStatus("done");
            setStatusMessage(t("tiktok_share.status_published"));
            closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 2000);
            return;
          }
          if (status === "SEND_TO_USER_INBOX") {
            setPostStatus("done");
            setStatusMessage(t("tiktok_share.status_inbox"));
            closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 2000);
            return;
          }
          if (status === "FAILED") {
            setPostStatus("failed");
            setFailReason(data.fail_reason || t("tiktok_share.fail_unknown"));
            setStatusMessage("");
            return;
          }

          setPostStatus("processing");
          setStatusMessage(
            attempt >= 15
              ? t("tiktok_share.status_processing_long")
              : t("tiktok_share.status_processing")
          );
        }
      } catch (e) {
        console.error("Erro ao consultar status TikTok:", e);
      }

      if (cancelledRef.current) return;

      if (attempt >= MAX_ATTEMPTS) {
        setPostStatus("processing");
        setStatusMessage(t("tiktok_share.status_timeout"));
        return;
      }

      const delay = attempt < 10 ? 3000 : 5000;
      pollTimerRef.current = window.setTimeout(tick, delay);
    };

    setPostStatus("processing");
    setStatusMessage(t("tiktok_share.status_processing"));
    pollTimerRef.current = window.setTimeout(tick, 3000);
  };

  const checkTikTokConnection = async () => {
    setCheckingConnection(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        return;
      }

      const nowIso = new Date().toISOString();

      const { data: integration } = await supabase
        .from("integrations")
        .select("id, is_active, platform, token_expires_at")
        .eq("user_id", user.id)
        .eq("platform", "tiktok")
        .eq("is_active", true)
        .gt("token_expires_at", nowIso)
        .maybeSingle();

      const connected = !!integration;
      setIsConnected(connected);

      if (connected) {
        await loadCreatorInfo(user.id);
      }
    } catch (error) {
      console.error("Erro ao verificar conexão TikTok:", error);
      setIsConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnectTikTok = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("tiktok_share.err_login"));
      return;
    }
    const authUrl = buildTikTokAuthUrl(user.id);
    onOpenChange(false);
    window.location.href = authUrl;
  };

  const disclosureIncompleto = commercialContent && !brandOrganic && !brandedContent;
  const brandedContentPrivado = brandedContent && privacyLevel === "SELF_ONLY";
  const duracaoExcedida =
    videoDuration !== null &&
    creator?.max_video_post_duration_sec != null &&
    videoDuration > creator.max_video_post_duration_sec;

  const bloqueado =
    postMode === "direct" &&
    (!privacyLevel || disclosureIncompleto || brandedContentPrivado || duracaoExcedida);

  const handlePost = async () => {
    if (!caption.trim()) {
      toast.error(t("tiktok_share.err_caption"));
      return;
    }
    if (postMode === "direct" && !privacyLevel) {
      toast.error(t("tiktok_share.err_choose_privacy"));
      return;
    }
    if (postMode === "direct" && disclosureIncompleto) {
      toast.error(t("tiktok_share.err_disclosure"));
      return;
    }
    if (postMode === "direct" && brandedContentPrivado) {
      toast.error(t("tiktok_share.err_branded_private"));
      return;
    }
    if (duracaoExcedida) {
      toast.error(t("tiktok_share.err_duration", { max: creator?.max_video_post_duration_sec }));
      return;
    }

    cancelledRef.current = false;
    setFailReason("");
    setAttempts(0);
    setPostStatus("uploading");
    setStatusMessage(t("tiktok_share.status_uploading"));
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        setPostStatus("idle");
        return;
      }

      const { data, error } = await supabase.functions.invoke("tiktok-post-content", {
        body: {
          user_id: user.id,
          content_type: content.type,
          content_url: content.url,
          title: caption.slice(0, 2200),
          post_mode: postMode,
          source: "manual",
          privacy_level: postMode === "direct" ? privacyLevel : undefined,
          disable_comment: !allowComment,
          disable_duet: !allowDuet,
          disable_stitch: !allowStitch,
          is_commercial_content: commercialContent,
          brand_organic: commercialContent && brandOrganic,
          branded_content: commercialContent && brandedContent,
        }
      });

      if (error) throw error;

      if (data.success) {
        if (data.publish_id) {
          startPolling(user.id, data.publish_id);
        } else {
          setPostStatus("done");
          setStatusMessage(data.message || t("tiktok_share.status_sent"));
          closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 2000);
        }
      } else {
        throw new Error(data.error || t("tiktok_share.err_post_generic"));
      }
    } catch (error: any) {
      console.error("Erro ao postar:", error);
      setPostStatus("failed");
      setFailReason(error.message || t("tiktok_share.err_send_generic"));
      toast.error(error.message || t("tiktok_share.err_send_generic"));
    } finally {
      setLoading(false);
    }
  };

  const handleDialogChange = (next: boolean) => {
    if (!next) clearTimers();
    onOpenChange(next);
  };

  if (checkingConnection) {
    return (
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isConnected) {
    return (
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
              </svg>
              {t("tiktok_share.connect_title")}
            </DialogTitle>
            <DialogDescription>
              {t("tiktok_share.connect_description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">{t("tiktok_share.benefits_title")}</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>{t("tiktok_share.benefit_1")}</li>
                <li>{t("tiktok_share.benefit_2")}</li>
                <li>{t("tiktok_share.benefit_3")}</li>
              </ul>
            </div>

            <Button onClick={handleConnectTikTok} className="w-full" size="lg">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("tiktok_share.connect_button")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
            </svg>
            {t("tiktok_share.dialog_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conta do criador (via creator_info, sem cache) */}
          {loadingCreator ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("tiktok_share.loading_account")}</span>
            </div>
          ) : creator ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {creator.creator_avatar_url && (
                    <AvatarImage src={creator.creator_avatar_url} alt={creator.creator_nickname || "TikTok"} />
                  )}
                  <AvatarFallback>
                    {(creator.creator_nickname || creator.creator_username || "T").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("tiktok_share.posting_to_account")}</p>
                  <p className="font-semibold truncate">{creator.creator_nickname || "—"}</p>
                  {creator.creator_username && (
                    <p className="text-xs text-muted-foreground truncate">@{creator.creator_username}</p>
                  )}
                </div>
              </div>
            </div>
          ) : creatorError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{creatorError}</p>
                <Button size="sm" variant="outline" onClick={() => checkTikTokConnection()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("tiktok_share.try_again")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Preview */}
          <div className="aspect-[9/16] max-h-[300px] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {content.type === "video" ? (
              <video
                src={content.url}
                className="w-full h-full object-contain"
                controls
                muted
              />
            ) : (
              <img
                src={content.url}
                alt={t("tiktok_share.preview_alt")}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label>{t("tiktok_share.caption_label")}</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("tiktok_share.caption_placeholder")}
              className="min-h-[100px]"
              maxLength={2200}
            />
            <p className="text-xs text-muted-foreground text-right">
              {t("tiktok_share.caption_counter", { count: caption.length })}
            </p>
          </div>

          {/* Post Mode */}
          <div className="space-y-2">
            <Label>{t("tiktok_share.post_mode_label")}</Label>
            <RadioGroup value={postMode} onValueChange={(v) => setPostMode(v as "direct" | "draft")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="draft" id="draft" />
                <Label htmlFor="draft" className="cursor-pointer">
                  {t("tiktok_share.mode_draft")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="direct" id="direct" />
                <Label htmlFor="direct" className="cursor-pointer">
                  {t("tiktok_share.mode_direct")}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {postMode === "draft"
                ? t("tiktok_share.mode_draft_help")
                : t("tiktok_share.mode_direct_help")
              }
            </p>
          </div>

          {postMode === "direct" && (
            <div className="space-y-4 rounded-lg border p-3">
              {/* Privacidade — somente opções vindas da API */}
              <div className="space-y-2">
                <Label>{t("tiktok_share.privacy_label")}</Label>
                {creator && creator.privacy_level_options.length > 0 ? (
                  <RadioGroup value={privacyLevel} onValueChange={setPrivacyLevel}>
                    {creator.privacy_level_options.map((opt) => {
                      const bloqueadoPorBranded = brandedContent && opt === "SELF_ONLY";
                      return (
                        <div
                          key={opt}
                          className="flex items-center space-x-2"
                          title={
                            bloqueadoPorBranded
                              ? t("tiktok_share.branded_private_tooltip")
                              : undefined
                          }
                        >
                          <RadioGroupItem
                            value={opt}
                            id={`privacy-${opt}`}
                            disabled={bloqueadoPorBranded}
                          />
                          <Label
                            htmlFor={`privacy-${opt}`}
                            className={
                              bloqueadoPorBranded
                                ? "text-muted-foreground opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            }
                          >
                            {PRIVACY_LABELS[opt] || opt}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>

                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("tiktok_share.privacy_load_hint")}
                  </p>
                )}
                {!privacyLevel && (
                  <p className="text-xs text-muted-foreground">{t("tiktok_share.privacy_select_hint")}</p>
                )}
              </div>

              {/* Interações */}
              <div className="space-y-3">
                <Label>{t("tiktok_share.interactions_label")}</Label>
                <div className="flex items-center justify-between">
                  <Label htmlFor="allow-comment" className="text-sm font-normal">
                    {t("tiktok_share.comments")}
                    {creator?.comment_disabled && (
                      <span className="block text-xs text-muted-foreground">{t("tiktok_share.disabled_in_account")}</span>
                    )}
                  </Label>
                  <Switch
                    id="allow-comment"
                    checked={allowComment}
                    disabled={!!creator?.comment_disabled}
                    onCheckedChange={setAllowComment}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="allow-duet" className="text-sm font-normal">
                    {t("tiktok_share.duets")}
                    {creator?.duet_disabled && (
                      <span className="block text-xs text-muted-foreground">Desativado nas configurações da sua conta</span>
                    )}
                  </Label>
                  <Switch
                    id="allow-duet"
                    checked={allowDuet}
                    disabled={!!creator?.duet_disabled}
                    onCheckedChange={setAllowDuet}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="allow-stitch" className="text-sm font-normal">
                    {t("tiktok_share.stitch")}
                    {creator?.stitch_disabled && (
                      <span className="block text-xs text-muted-foreground">Desativado nas configurações da sua conta</span>
                    )}
                  </Label>
                  <Switch
                    id="allow-stitch"
                    checked={allowStitch}
                    disabled={!!creator?.stitch_disabled}
                    onCheckedChange={setAllowStitch}
                  />
                </div>
              </div>

              {/* Disclosure comercial */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="commercial" className="text-sm">
                    {t("tiktok_share.commercial_label")}
                    <span className="block text-xs text-muted-foreground font-normal">
                      {t("tiktok_share.commercial_description")}
                    </span>
                  </Label>
                  <Switch
                    id="commercial"
                    checked={commercialContent}
                    onCheckedChange={(v) => {
                      setCommercialContent(v);
                      if (!v) {
                        setBrandOrganic(false);
                        setBrandedContent(false);
                      }
                    }}
                  />
                </div>

                {commercialContent && (
                  <div className="space-y-2 pl-1">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="brand-organic"
                        checked={brandOrganic}
                        onCheckedChange={(v) => setBrandOrganic(!!v)}
                      />
                      <Label htmlFor="brand-organic" className="text-sm font-normal cursor-pointer">
                        {t("tiktok_share.brand_organic")}
                        <span className="block text-xs text-muted-foreground">
                          {t("tiktok_share.brand_organic_description")}
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="branded-content"
                        checked={brandedContent}
                        onCheckedChange={(v) => {
                          setBrandedContent(!!v);
                          // Conteúdo de marca não pode ser privado: limpa a escolha
                          if (v && privacyLevel === "SELF_ONLY") setPrivacyLevel("");
                        }}
                      />
                      <Label htmlFor="branded-content" className="text-sm font-normal cursor-pointer">
                        {t("tiktok_share.branded_content")}
                        <span className="block text-xs text-muted-foreground">
                          {t("tiktok_share.branded_content_description")}
                        </span>
                      </Label>
                    </div>

                    {disclosureIncompleto && (
                      <>
                        <p className="text-xs text-destructive">
                          {t("tiktok_share.disclosure_incomplete")}
                        </p>
                        {!isEnglish && (
                          <p className="text-xs text-muted-foreground">
                            You need to indicate if your content promotes yourself, a third party, or both.
                          </p>
                        )}
                      </>
                    )}
                    {brandedContentPrivado && (
                      <p className="text-xs text-destructive">
                        {t("tiktok_share.branded_private_error")}
                      </p>
                    )}
                    {brandedContent && (
                      <p className="text-xs text-muted-foreground">
                        {t("tiktok_share.label_paid_partnership")}
                      </p>
                    )}
                    {!brandedContent && brandOrganic && (
                      <p className="text-xs text-muted-foreground">
                        {t("tiktok_share.label_promotional")}
                      </p>
                    )}
                  </div>
                )}
              </div>


            </div>
          )}

          {duracaoExcedida && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t("tiktok_share.duration_exceeded", {
                  duration: Math.round(videoDuration!),
                  max: creator?.max_video_post_duration_sec,
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Acompanhamento do status real da publicação */}
          {(postStatus === "uploading" || postStatus === "processing") && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {statusMessage}
                {postStatus === "processing" && attempts > 0 && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    {t("tiktok_share.check_progress", { current: attempts, total: MAX_ATTEMPTS })}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {postStatus === "done" && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}

          {postStatus === "failed" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{failReason}</p>
                <Button size="sm" variant="outline" onClick={handlePost}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("tiktok_share.try_again")}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Declaração de consentimento — exigência literal do TikTok. NÃO traduzir os literais em inglês. */}
          <div className="space-y-1 border-t pt-3">
            {commercialContent && brandedContent ? (
              <>
                {!isEnglish && (
                  <p className="text-sm">
                    {t("tiktok_share.consent_prefix")}{" "}
                    <a
                      href="https://www.tiktok.com/legal/page/global/bc-policy/pt-BR"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      {t("tiktok_share.link_branded_policy")}
                    </a>{" "}
                    {t("tiktok_share.consent_and")}{" "}
                    <a
                      href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      {t("tiktok_share.link_music_usage")}
                    </a>{" "}
                    {t("tiktok_share.consent_suffix")}
                  </p>
                )}
                <p className={isEnglish ? "text-sm" : "text-xs text-muted-foreground"}>
                  By posting, you agree to TikTok's{" "}
                  <a
                    href="https://www.tiktok.com/legal/page/global/bc-policy/pt-BR"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Branded Content Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Music Usage Confirmation
                  </a>
                  .
                </p>
              </>
            ) : (
              <>
                {!isEnglish && (
                  <p className="text-sm">
                    {t("tiktok_share.consent_prefix")}{" "}
                    <a
                      href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      {t("tiktok_share.link_music_usage")}
                    </a>{" "}
                    {t("tiktok_share.consent_suffix")}
                  </p>
                )}
                <p className={isEnglish ? "text-sm" : "text-xs text-muted-foreground"}>
                  By posting, you agree to TikTok's{" "}
                  <a
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    Music Usage Confirmation
                  </a>
                  .
                </p>
              </>
            )}
          </div>

          {/* Botão de enviar */}

          {postStatus !== "done" && postStatus !== "failed" && (
            <span
              className="block"
              title={
                disclosureIncompleto
                  ? t("tiktok_share.disclosure_incomplete")
                  : undefined
              }
            >
              <Button
                onClick={handlePost}
                disabled={loading || !caption.trim() || postStatus === "processing" || bloqueado || loadingCreator}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
                size="lg"
              >
                {loading || postStatus === "processing" ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {postStatus === "processing" ? t("tiktok_share.btn_processing") : t("tiktok_share.btn_sending")}
                  </>
                ) : (
                  <>
                    {content.type === "video" ? <Video className="mr-2 h-5 w-5" /> : <Image className="mr-2 h-5 w-5" />}
                    {postMode === "draft" ? t("tiktok_share.btn_save_draft") : t("tiktok_share.btn_publish")}
                  </>
                )}
              </Button>
            </span>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};
