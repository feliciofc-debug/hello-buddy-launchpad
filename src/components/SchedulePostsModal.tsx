import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Plus, X, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ScheduledPost {
  id: string;
  data: string;
  hora: string;
  redes: string[];
  conteudo: string;
}

interface SchedulePostsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postContent: {
    instagram: string;
    facebook: string;
    story: string;
    whatsapp?: string;
  };
  userType?: string;
}

export function SchedulePostsModal({ open, onOpenChange, postContent, userType = 'afiliado' }: SchedulePostsModalProps) {
  const [frequency, setFrequency] = useState<'now' | 'once' | 'daily' | 'weekly' | 'custom'>('once');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [scheduleEndDate, setScheduleEndDate] = useState<Date>();
  const [hasEndDate, setHasEndDate] = useState(false);
  const [customDates, setCustomDates] = useState<Date[]>([]);
  
  // Horários múltiplos
  const [timeSlots, setTimeSlots] = useState<string[]>(["10:00"]);
  
  // Dias da semana (para diário/semanal)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg-Sex
  
  // Redes sociais
  const [networks, setNetworks] = useState({
    instagramFeed: true,
    instagramStories: true,
    facebook: false,
    tiktok: false
  });

  // Preview de postagens
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const addTimeSlot = () => {
    if (timeSlots.length < 10) {
      setTimeSlots([...timeSlots, "14:00"]);
    } else {
      toast.error("Máximo de 10 horários por dia!");
    }
  };

  const removeTimeSlot = (index: number) => {
    if (timeSlots.length > 1) {
      setTimeSlots(timeSlots.filter((_, i) => i !== index));
    }
  };

  const updateTimeSlot = (index: number, value: string) => {
    const newSlots = [...timeSlots];
    newSlots[index] = value;
    setTimeSlots(newSlots);
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleNetwork = (network: keyof typeof networks) => {
    setNetworks(prev => ({ ...prev, [network]: !prev[network] }));
  };

  const generatePreview = () => {
    const posts: ScheduledPost[] = [];
    const selectedNetworks = Object.entries(networks)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => {
        if (key === 'instagramFeed') return 'Instagram Feed';
        if (key === 'instagramStories') return 'Instagram Stories';
        if (key === 'facebook') return 'Facebook';
        if (key === 'tiktok') return 'TikTok';
        return key;
      });

    if (selectedNetworks.length === 0) {
      toast.error("Selecione pelo menos uma rede social!");
      return;
    }

    switch (frequency) {
      case 'now':
        posts.push({
          id: Date.now().toString(),
          data: format(new Date(), "dd/MM/yyyy"),
          hora: format(new Date(), "HH:mm"),
          redes: selectedNetworks,
          conteudo: postContent.instagram.substring(0, 50) + "..."
        });
        break;

      case 'once':
        if (!selectedDate) {
          toast.error("Selecione uma data!");
          return;
        }
        timeSlots.forEach(time => {
          posts.push({
            id: `${selectedDate.toISOString()}-${time}`,
            data: format(selectedDate, "dd/MM/yyyy"),
            hora: time,
            redes: selectedNetworks,
            conteudo: postContent.instagram.substring(0, 50) + "..."
          });
        });
        break;

      case 'daily':
        if (!selectedDate) {
          toast.error("Selecione uma data de início!");
          return;
        }
        const endDaily = hasEndDate && scheduleEndDate ? scheduleEndDate : new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        for (let d = new Date(selectedDate); d <= endDaily; d.setDate(d.getDate() + 1)) {
          if (selectedDays.includes(d.getDay())) {
            timeSlots.forEach(time => {
              posts.push({
                id: `${d.toISOString()}-${time}`,
                data: format(d, "dd/MM/yyyy"),
                hora: time,
                redes: selectedNetworks,
                conteudo: postContent.instagram.substring(0, 50) + "..."
              });
            });
          }
        }
        break;

      case 'weekly':
        if (!selectedDate) {
          toast.error("Selecione uma data de início!");
          return;
        }
        const endWeekly = hasEndDate && scheduleEndDate ? scheduleEndDate : new Date(selectedDate.getTime() + 28 * 24 * 60 * 60 * 1000);
        
        for (let d = new Date(selectedDate); d <= endWeekly; d.setDate(d.getDate() + 1)) {
          if (selectedDays.includes(d.getDay())) {
            timeSlots.forEach(time => {
              posts.push({
                id: `${d.toISOString()}-${time}`,
                data: format(d, "dd/MM/yyyy"),
                hora: time,
                redes: selectedNetworks,
                conteudo: postContent.instagram.substring(0, 50) + "..."
              });
            });
          }
        }
        break;

      case 'custom':
        if (customDates.length === 0) {
          toast.error("Selecione pelo menos uma data no calendário!");
          return;
        }
        customDates.forEach(date => {
          timeSlots.forEach(time => {
            posts.push({
              id: `${date.toISOString()}-${time}`,
              data: format(date, "dd/MM/yyyy"),
              hora: time,
              redes: selectedNetworks,
              conteudo: postContent.instagram.substring(0, 50) + "..."
            });
          });
        });
        break;
    }

    setScheduledPosts(posts);
    toast.success(`${posts.length} postagens geradas no preview!`);
  };

  const removePost = (id: string) => {
    setScheduledPosts(scheduledPosts.filter(p => p.id !== id));
  };

  const confirmSchedule = async () => {
    if (scheduledPosts.length === 0) {
      toast.error("Gere o preview primeiro!");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Salvar post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: userData.user.id,
          titulo: postContent.instagram?.substring(0, 100) || "Post agendado",
          texto_instagram: postContent.instagram,
          texto_story: postContent.story,
          texto_facebook: postContent.facebook,
          status: 'agendado'
        })
        .select()
        .single();

      if (postError) throw postError;

      // Salvar agendamentos
      const agendamentos = scheduledPosts.map(post => ({
        post_id: postData.id,
        user_id: userData.user.id,
        data: post.data.split('/').reverse().join('-'),
        hora: post.hora,
        redes: post.redes,
        status: 'agendado'
      }));

      const { error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert(agendamentos);

      if (scheduleError) throw scheduleError;
      
      toast.success(`✅ ${scheduledPosts.length} postagens agendadas com sucesso!`);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao agendar postagens!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">📅 Agendamento Completo de Postagens</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 1. FREQUÊNCIA */}
          <div>
            <Label className="text-base font-semibold mb-3 block">1. Escolha a Frequência</Label>
            <RadioGroup value={frequency} onValueChange={(v: any) => setFrequency(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="now" />
                <Label htmlFor="now" className="cursor-pointer">🚀 Postar Agora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="once" id="once" />
                <Label htmlFor="once" className="cursor-pointer">📅 Agendar Uma Vez</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily" className="cursor-pointer">🔁 Diário</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly" className="cursor-pointer">📆 Semanal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer">✨ Personalizado</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 2. DATA E HORÁRIOS */}
          {frequency !== 'now' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <Label className="text-base font-semibold">2. Selecione Data e Horários</Label>
              
              {frequency === 'custom' ? (
                <div>
                  <Label className="text-sm mb-2 block">Clique nas datas para adicionar/remover</Label>
                  <Calendar
                    mode="multiple"
                    selected={customDates}
                    onSelect={(dates) => setCustomDates(dates || [])}
                    className="pointer-events-auto rounded-md border"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {customDates.length} data(s) selecionada(s)
                  </p>
                </div>
              ) : (
                <div>
                  <Label className="text-sm mb-2 block">Data de Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left", !selectedDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Dias da Semana (para diário/semanal) */}
              {(frequency === 'daily' || frequency === 'weekly') && (
                <div>
                  <Label className="text-sm mb-2 block">Dias da Semana</Label>
                  <div className="flex gap-2 flex-wrap">
                    {dayNames.map((day, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => toggleDay(index)}
                        className={selectedDays.includes(index) 
                          ? "bg-green-600 hover:bg-green-700 text-white border-green-600" 
                          : "bg-red-600 hover:bg-red-700 text-white border-red-600"}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Final (para diário/semanal) */}
              {(frequency === 'daily' || frequency === 'weekly') && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hasEndDate" checked={hasEndDate} onCheckedChange={(checked) => setHasEndDate(checked as boolean)} />
                    <Label htmlFor="hasEndDate" className="cursor-pointer">Definir data final</Label>
                  </div>
                  {hasEndDate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left", !scheduleEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduleEndDate ? format(scheduleEndDate, "dd/MM/yyyy") : "Até quando?"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={scheduleEndDate} onSelect={setScheduleEndDate} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* Horários Múltiplos */}
              <div>
                <Label className="text-sm mb-2 block">Horários do Dia</Label>
                <div className="space-y-2">
                  {timeSlots.map((time, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="time"
                        value={time}
                        onChange={(e) => updateTimeSlot(index, e.target.value)}
                        className="flex-1"
                      />
                      {timeSlots.length > 1 && (
                        <Button variant="outline" size="icon" onClick={() => removeTimeSlot(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTimeSlot} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Horário
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 3. REDES SOCIAIS */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-base font-semibold mb-3 block">3. Redes Sociais</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="instagramFeed" checked={networks.instagramFeed} onCheckedChange={() => toggleNetwork('instagramFeed')} />
                <Label htmlFor="instagramFeed" className="cursor-pointer">📷 Instagram Feed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="instagramStories" checked={networks.instagramStories} onCheckedChange={() => toggleNetwork('instagramStories')} />
                <Label htmlFor="instagramStories" className="cursor-pointer">📲 Instagram Stories</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="facebook" checked={networks.facebook} onCheckedChange={() => toggleNetwork('facebook')} />
                <Label htmlFor="facebook" className="cursor-pointer">👍 Facebook</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="tiktok" checked={networks.tiktok} onCheckedChange={() => toggleNetwork('tiktok')} />
                <Label htmlFor="tiktok" className="cursor-pointer">🎵 TikTok</Label>
              </div>
            </div>
          </div>

          {/* 4. PREVIEW */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">4. Preview das Postagens</Label>
              <Button onClick={generatePreview} variant="outline">
                🔄 Gerar Preview
              </Button>
            </div>

            {scheduledPosts.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-primary/10 p-2 text-sm font-semibold">
                  {scheduledPosts.length} postagens agendadas
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Redes</TableHead>
                        <TableHead>Conteúdo</TableHead>
                        <TableHead className="w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledPosts.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-medium">{post.data}</TableCell>
                          <TableCell>{post.hora}</TableCell>
                          <TableCell className="text-xs">{post.redes.join(', ')}</TableCell>
                          <TableCell className="text-xs">{post.conteudo}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removePost(post.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                Clique em "Gerar Preview" para visualizar as postagens
              </div>
            )}
          </div>

          {/* 5. CONFIRMAR */}
          <Button 
            onClick={confirmSchedule} 
            disabled={scheduledPosts.length === 0}
            className="w-full h-12 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            ✅ AGENDAR {scheduledPosts.length} POSTAGENS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
