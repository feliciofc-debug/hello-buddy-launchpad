import { useState, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

export function useNotificationSound() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Carregar preferências do localStorage
  useEffect(() => {
    const savedEnabled = localStorage.getItem('sound-notifications-enabled');
    const savedVolume = localStorage.getItem('sound-notifications-volume');
    
    if (savedEnabled !== null) {
      setEnabled(savedEnabled === 'true');
    }
    
    if (savedVolume !== null) {
      setVolume(parseFloat(savedVolume));
    }
  }, []);

  // Toggle som
  const toggleSound = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    localStorage.setItem('sound-notifications-enabled', String(newValue));
    
    toast({
      title: newValue ? '🔔 Sons ativados' : '🔇 Sons desativados',
      description: newValue 
        ? 'Você receberá notificações sonoras' 
        : 'Notificações sonoras desativadas'
    });
  };

  // Alterar volume
  const changeVolume = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem('sound-notifications-volume', String(newVolume));
  };

  // Tocar som
  const playSound = (soundType: 'caixa' | 'mensagem' | 'venda') => {
    if (!enabled) return;

    try {
      // URLs de sons gratuitos online
      const sounds: Record<string, string> = {
        caixa: 'https://www.soundjay.com/misc/sounds/cash-register-1.mp3',
        mensagem: 'https://www.soundjay.com/buttons/sounds/button-09a.mp3',
        venda: 'https://www.soundjay.com/human/sounds/applause-8.mp3'
      };

      // Criar ou reusar elemento de áudio
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = sounds[soundType];
      audioRef.current.volume = volume;
      
      // Tocar
      audioRef.current.play().catch(error => {
        console.warn('Erro ao tocar som:', error);
        // Browser pode bloquear autoplay
        if (error.name === 'NotAllowedError') {
          toast({
            title: '🔇 Sons bloqueados',
            description: 'Clique em qualquer lugar para ativar sons',
            variant: 'destructive'
          });
        }
      });

      // Vibrar dispositivo se suportado
      if ('vibrate' in navigator) {
        if (soundType === 'caixa') {
          navigator.vibrate([200, 100, 200]); // Trin-tlin
        } else if (soundType === 'mensagem') {
          navigator.vibrate(100);
        } else if (soundType === 'venda') {
          navigator.vibrate([100, 50, 100, 50, 100]);
        }
      }
    } catch (error) {
      console.error('Erro ao tocar som:', error);
    }
  };

  // Testar som
  const testSound = () => {
    playSound('caixa');
  };

  return {
    enabled,
    volume,
    toggleSound,
    changeVolume,
    playSound,
    testSound
  };
}
