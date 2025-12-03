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
    if (!enabled) {
      console.log('🔇 Som desativado');
      return;
    }

    console.log(`🔔 Tocando som: ${soundType}`);

    try {
      // URLs de sons PÚBLICOS que funcionam sem autenticação
      const sounds: Record<string, string> = {
        caixa: 'https://www.soundjay.com/misc/sounds/cash-register-1.mp3', // Cash register
        mensagem: 'https://www.soundjay.com/buttons/sounds/button-09.mp3', // Notification beep
        venda: 'https://www.soundjay.com/human/sounds/applause-8.mp3' // Applause
      };

      console.log(`🔊 Tentando tocar: ${sounds[soundType]}`);

      // Criar novo elemento de áudio sempre
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = sounds[soundType];
      audio.volume = volume;
      
      // Tentar tocar
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`✅ Som ${soundType} tocando!`);
          })
          .catch(error => {
            console.warn('⚠️ Erro ao tocar som:', error);
            
            // Fallback: usar Web Audio API para beep simples
            try {
              const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.value = soundType === 'caixa' ? 800 : 600;
              oscillator.type = 'sine';
              gainNode.gain.value = volume * 0.3;
              
              oscillator.start();
              setTimeout(() => {
                oscillator.stop();
                console.log('🔔 Beep alternativo tocado!');
              }, 200);
            } catch (fallbackError) {
              console.error('❌ Erro no fallback de som:', fallbackError);
            }
            
            // Browser pode bloquear autoplay
            if (error.name === 'NotAllowedError') {
              toast({
                title: '🔇 Sons bloqueados',
                description: 'Clique em qualquer lugar para ativar sons',
                variant: 'destructive'
              });
            }
          });
      }

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
      console.error('❌ Erro ao tocar som:', error);
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
