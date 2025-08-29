import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { httpClient } from "@/lib/http";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
// Remover ToastAction não utilizado
// import { ToastAction } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
import "@/components/map-styles.css";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeImageUrl } from "@/lib/utils";
import { applyCNPJMask, applyPhoneMask, extractDigits, isValidCNPJFormat, isValidPhoneFormat } from "@/lib/utils";

// Tipos
type PauseData = { paused: boolean; message: string };

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type DayConfig = { closed: boolean; open: string; close: string };
export type BusinessHours = Record<DayKey, DayConfig>;


type MapboxKeyStatus = { success: boolean; exists: boolean; length: number; masked: string };

type ApiResponse<T> = { success: boolean; data: T };

type MapboxApiStatus = {
  geocoding: { success: boolean; message: string };
  directions: { success: boolean; message: string };
  maploads: { success: boolean; message: string };
};

/* Removido: tipo não utilizado
type CompanySettings = {
  name: string;
  document: string;
  phone: string;
  email: string;
  logo_url?: string;
  address: {
    zip: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
};
*/
// Define o payload de company_info vindo do backend
type CompanyInfo = {
  company_name: string;
  cnpj: string;
  phone: string;
  zip_code?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  company_color: string;
  logo_url?: string;
};

type PaymentMethods = {
  pix: { enabled: boolean; key: string };
  cash: { enabled: boolean };
  credit: { enabled: boolean };
  debit: { enabled: boolean };
  notes?: string;
};

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role === 'admin');

  // Estado: Pausa de pedidos
  const [pauseLoading, setPauseLoading] = useState(true);
  const [pauseSaving, setPauseSaving] = useState(false);
  const [pause, setPause] = useState<PauseData>({ paused: false, message: "" });

  // Estado: Horários
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hours, setHours] = useState<BusinessHours | null>(null);

  const [copySource, setCopySource] = useState<DayKey>("monday");


  // Mapbox
  const [mLoading, setMLoading] = useState(true);
  const [mSaving, setMSaving] = useState(false);
  const [mStatus, setMStatus] = useState<MapboxKeyStatus | null>(null);
  const [mNewKey, setMNewKey] = useState("");
  const [mApiStatus, setMApiStatus] = useState<MapboxApiStatus | null>(null);
  const [mApiStatusLoading, setMApiStatusLoading] = useState(false);
  // Nova: chave pública do Mapbox (uso apenas em tempo de execução)
  const [mPublicKey, setMPublicKey] = useState<string | null>(null);
  const [mPublicKeyLoading, setMPublicKeyLoading] = useState(true);

  // Estados: Empresa
  const [cLoading, setCLoading] = useState(true);
  const [cSaving, setCSaving] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>({
    company_name: "",
    cnpj: "",
    phone: "",
    zip_code: "",
    address: "",
    latitude: 0,
    longitude: 0,
    company_color: "#000000",
    logo_url: "",
  });

  // Estados de mapa
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lng: number; lat: number } | null>(null);
  // const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geocoderContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Estados: Pagamentos
  const [pLoading, setPLoading] = useState(true);
  const [pSaving, setPSaving] = useState(false);
  const [payments, setPayments] = useState<PaymentMethods>({
    pix: { enabled: false, key: "" },
    cash: { enabled: false },
    credit: { enabled: false },
    debit: { enabled: false },
    notes: "",
  });

  // ====== Carregamento inicial ======
  useEffect(() => {
    // Empresa
    (async () => {
      try {
        const res = await httpClient.get<{ success: boolean; data?: CompanyInfo; message?: string }>(
          '/settings/company-info'
        );
        if (res?.success && res.data) setCompany(res.data);
      } catch (e: any) {
        // silencioso; mostrará ao salvar
      } finally { setCLoading(false); }
    })();

    // Horários
    (async () => {
      try {
        const res = await httpClient.get<ApiResponse<BusinessHours>>('/settings/business-hours');
        if (res?.data) setHours(res.data);
      } catch (e: any) {
      } finally { setHoursLoading(false); }
    })();

    // Pausa
    (async () => {
      try {
        const res = await httpClient.get<ApiResponse<PauseData>>('/settings/pause');
        if (res?.data) setPause(res.data);
      } catch (e: any) {
      } finally { setPauseLoading(false); }
    })();

    // Métodos de pagamento
    (async () => {
      try {
        const res = await httpClient.get<ApiResponse<PaymentMethods>>('/settings/payment-methods');
        if (res?.data) setPayments(res.data);
      } catch (e: any) {
      } finally { setPLoading(false); }
    })();

    // Mapbox status
    (async () => {
      try {
        const res = await httpClient.get<MapboxKeyStatus>('/settings/mapbox-api-key');
        setMStatus(res);
      } catch (e: any) {
      } finally { setMLoading(false); }
    })();

    // Mapbox public key
    (async () => {
      console.log('🔍 MAPBOX DEBUG: Iniciando carregamento da chave pública...');
      try {
        const res = await httpClient.get<{ success: boolean; public_key?: string; message?: string }>(
          '/settings/mapbox-public-key'
        );
        console.log('🔍 MAPBOX DEBUG: Resposta da API:', res);
        
        const publicKey = res?.public_key || null;
        console.log('🔍 MAPBOX DEBUG: Chave pública extraída:', publicKey ? 'EXISTE' : 'NÃO EXISTE', publicKey?.substring(0, 10) + '...' || 'null');
        setMPublicKey(publicKey);
      } catch (e: any) {
      } finally {
        setMPublicKeyLoading(false);
      }
    })();

  }, []);

  // ====== Handlers de salvar ======
  async function saveCompany() {
    setCSaving(true);
    try {
      // Validações antes de enviar
      if (company.cnpj && !isValidCNPJFormat(company.cnpj)) {
        toast({ title: 'CNPJ inválido', description: 'Informe um CNPJ válido com 14 dígitos.', variant: 'destructive' as any });
        return;
      }
      if (company.phone && !isValidPhoneFormat(company.phone)) {
        toast({ title: 'Telefone inválido', description: 'Informe um telefone válido com DDD.', variant: 'destructive' as any });
        return;
      }

      // Preparar payload com apenas dígitos nos campos CNPJ e telefone
      const payload: CompanyInfo = {
        ...company,
        cnpj: extractDigits(company.cnpj),
        phone: extractDigits(company.phone)
      };

      const r = await httpClient.post<{ success: boolean }, CompanyInfo>('/settings/company-info', payload);
      if (!r?.success) throw new Error('Falha ao salvar');
      toast({ title: 'Empresa', description: 'Dados salvos com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao salvar empresa', variant: 'destructive' as any });
    } finally { setCSaving(false); }
  }

  async function saveHours() {
    if (!hours) return;
    setHoursSaving(true);
    try {
      const r = await httpClient.post<ApiResponse<{ ok: boolean }>, BusinessHours>('/settings/business-hours', hours);
      if (!(r as any)?.success) throw new Error('Falha ao salvar');
      toast({ title: 'Horários', description: 'Horários salvos com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao salvar horários', variant: 'destructive' as any });
    } finally { setHoursSaving(false); }
  }

  async function savePause() {
    setPauseSaving(true);
    try {
      const r = await httpClient.post<ApiResponse<{ ok: boolean }>, PauseData>('/settings/pause', pause);
      if (!(r as any)?.success) throw new Error('Falha ao salvar');
      toast({ title: 'Pausa', description: 'Estado de pausa atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao salvar pausa', variant: 'destructive' as any });
    } finally { setPauseSaving(false); }
  }

  async function savePayments() {
    setPSaving(true);
    try {
      const r = await httpClient.post<ApiResponse<{ ok: boolean }>, PaymentMethods>('/settings/payment-methods', payments);
      if (!(r as any)?.success) throw new Error('Falha ao salvar');
      toast({ title: 'Pagamentos', description: 'Métodos de pagamento salvos' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao salvar métodos de pagamento', variant: 'destructive' as any });
    } finally { setPSaving(false); }
  }

  async function onLogoFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLogoUploading(true);
      const fd = new FormData();
      fd.append('image', file);
      const payload = await httpClient.postFormData('/upload.php?mode=logo', fd);
      if (!payload?.success) throw new Error(payload?.message || 'Falha no upload');
      setCompany((c) => ({ ...c, logo_url: payload.url }));
      toast({ title: 'Logo', description: 'Upload concluído' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' as any });
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveMapboxKey() {
    setMSaving(true);
    try {
      const r = await httpClient.post<ApiResponse<{ ok: boolean }>, { key: string }>('/settings/mapbox-api-key', { key: mNewKey.trim() });
      if (!(r as any)?.success) throw new Error('Falha ao salvar');
      toast({ title: 'Mapbox', description: 'Chave atualizada com sucesso' });
      setMNewKey("");
      // refresh status
      try {
        setMLoading(true);
        const status = await httpClient.get<MapboxKeyStatus>('/settings/mapbox-api-key');
        setMStatus(status);
      } finally { setMLoading(false); }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao salvar chave', variant: 'destructive' as any });
    } finally { setMSaving(false); }
  }

  async function checkMapboxApiStatus() {
    try {
      setMApiStatusLoading(true);
      setMapError(null);
      const res: any = await httpClient.get('/mapbox/status');
      const results = res?.results;
      if (results) {
        const mapped: MapboxApiStatus = {
          geocoding: {
            success: results.geocoding?.status === 'success',
            message: results.geocoding?.message || '',
          },
          directions: {
            success: results.directions?.status === 'success',
            message: results.directions?.message || '',
          },
          maploads: {
            success: (results['map_loads']?.status || results.maploads?.status) === 'success',
            message: (results['map_loads']?.message || results.maploads?.message || ''),
          },
        };
        setMApiStatus(mapped);
        toast({ title: 'Teste concluído', description: res?.message || 'Status das APIs verificado' });
      } else {
        setMApiStatus(null);
        toast({ title: 'Falha ao testar APIs do Mapbox', description: res?.message || 'Resposta inválida do servidor', variant: 'destructive' as any });
      }
    } catch (e: any) {
      setMApiStatus(null);
      toast({ title: 'Erro ao testar APIs do Mapbox', description: e?.message || 'Erro desconhecido', variant: 'destructive' as any });
    } finally {
      setMApiStatusLoading(false);
    }
  }

  function updateDay(day: DayKey, patch: Partial<DayConfig>) {
    setHours((prev) => prev ? ({ ...prev, [day]: { ...prev[day], ...patch } }) : prev);
  }

  function copyToAllFrom(source: DayKey) {
    if (!hours) return;
    const src = hours[source];
    const next: BusinessHours = { ...hours } as BusinessHours;
    (Object.keys(next) as DayKey[]).forEach((d) => {
      if (d === source) return;
      next[d] = { ...src };
    });
    setHours(next);
  }

  // Função para validar chave Mapbox
  const validateMapboxKey = (key: string): boolean => {
    if (!key || typeof key !== 'string') return false;
    // Verifica se é uma chave pública válida (pk.xxxx) ou chave secreta (sk.xxxx)
    return /^pk\.[a-zA-Z0-9]{50,}$/.test(key) || /^sk\.[a-zA-Z0-9]{50,}$/.test(key);
  };

  // Função para forçar redimensionamento do mapa
  const forceMapResize = () => {
    if (mapRef.current && mapContainerRef.current) {
      setTimeout(() => {
        try {
          mapRef.current?.resize();
          console.log('[MapBox Debug] Mapa redimensionado forçadamente');
        } catch (error) {
          console.warn('[MapBox Debug] Erro ao redimensionar mapa:', error);
        }
      }, 500);
    }
  };

  // Inicialização mínima do mapa quando dialog abre e chave existe
  useEffect(() => {
    console.log('🔍 MAPBOX DEBUG: useEffect do mapa disparado', {
      mapOpen,
      hasPublicKey: !!mPublicKey,
      hasContainer: !!mapContainerRef.current,
      publicKeyLength: mPublicKey?.length
    });

    if (!mapOpen) {
      console.log('🔍 MAPBOX DEBUG: Modal fechada, limpando erro');
      setMapError(null);
      return;
    }

    if (!mPublicKey) {
      console.log('🔍 MAPBOX DEBUG: Chave pública não disponível');
      setMapError(null);
      return;
    }

    if (!mapContainerRef.current) {
      console.log('🔍 MAPBOX DEBUG: Container do mapa não encontrado');
      setTimeout(() => {
        console.log('🔍 MAPBOX DEBUG: Tentando novamente após 100ms...');
        if (mapContainerRef.current) {
          console.log('🔍 MAPBOX DEBUG: Container encontrado após delay');
        } else {
          console.error('🔍 MAPBOX DEBUG: Container ainda não encontrado após delay');
        }
      }, 100);
      return;
    }

    console.log('🔍 MAPBOX DEBUG: Dimensões do container:', {
      width: mapContainerRef.current.offsetWidth,
      height: mapContainerRef.current.offsetHeight,
      clientWidth: mapContainerRef.current.clientWidth,
      clientHeight: mapContainerRef.current.clientHeight
    });

    console.log('[MapBox Debug] Iniciando mapa com chave:', mPublicKey?.substring(0, 20) + '...');
    
    // Validar chave antes de tentar usar
    if (!validateMapboxKey(mPublicKey)) {
      const errorMsg = 'Chave Mapbox inválida. Verifique se a chave está no formato correto (pk.xxxx).';
      console.error('[MapBox Debug] Chave inválida:', mPublicKey);
      setMapError(errorMsg);
      toast({ 
        title: 'Erro do MapBox', 
        description: errorMsg, 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setMapError(null);
      console.log('🔍 MAPBOX DEBUG: Definindo accessToken...');
      mapboxgl.accessToken = mPublicKey;
      
      const hasCoords = !!(company.longitude && company.latitude);
      const center: [number, number] = hasCoords 
        ? [Number(company.longitude), Number(company.latitude)] 
        : [-46.6333, -23.5505];
      
      console.log('[MapBox Debug] Criando mapa com centro:', center);
      console.log('🔍 MAPBOX DEBUG: Configurações do mapa:', {
        container: mapContainerRef.current.id || 'sem-id',
        style: 'mapbox://styles/mapbox/streets-v11',
        center,
        zoom: hasCoords ? 14 : 11
      });
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center,
        zoom: hasCoords ? 14 : 11,
        antialias: true,
        projection: 'mercator'
      });
      
      console.log('🔍 MAPBOX DEBUG: Instância do mapa criada:', !!map);
      mapRef.current = map;

      // Adicionar controles
      try {
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        // @ts-ignore
        map.addControl(new mapboxgl.GeolocateControl({ 
          positionOptions: { enableHighAccuracy: true }, 
          trackUserLocation: true 
        }), 'top-right');
        console.log('[MapBox Debug] Controles adicionados com sucesso');
      } catch (controlError) {
        console.warn('[MapBox Debug] Erro ao adicionar controles:', controlError);
      }

      // Configurar geocoder
      try {
        const geocoder = new MapboxGeocoder({
          accessToken: mPublicKey,
          // @ts-ignore
          mapboxgl: mapboxgl,
          marker: false,
          language: 'pt-BR',
          placeholder: 'Buscar endereço',
          types: 'address,poi,place,locality,neighborhood',
          countries: 'BR'
        });

        if (geocoderContainerRef.current) {
          // Monta o geocoder em container dedicado acima do mapa
          (geocoder as any).addTo(geocoderContainerRef.current);
          console.log('[MapBox Debug] Geocoder adicionado ao container dedicado');
        } else {
          // Fallback: adiciona como controle do mapa
          map.addControl(geocoder as any, 'top-left');
          console.log('[MapBox Debug] Geocoder adicionado como controle do mapa');
        }

        (geocoder as any).on('result', (e: any) => {
          console.log('[MapBox Debug] Resultado do geocoder:', e);
          const [lng, lat] = e?.result?.center || [];
          if (typeof lng === 'number' && typeof lat === 'number') {
            setSelectedCoords({ lng, lat });
            if (!markerRef.current) {
              markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
            } else {
              markerRef.current.setLngLat([lng, lat]);
            }
            try { 
              map.flyTo({ center: [lng, lat], zoom: 15 }); 
            } catch (flyError) {
              console.warn('[MapBox Debug] Erro no flyTo:', flyError);
            }
          }
        });

        (geocoder as any).on('error', (error: any) => {
          console.error('[MapBox Debug] Erro no geocoder:', error);
          setMapError('Erro na busca de endereços. Verifique sua conexão.');
        });

      } catch (geocoderError) {
        console.error('[MapBox Debug] Erro ao criar geocoder:', geocoderError);
        setMapError('Erro ao inicializar busca de endereços.');
      }

      // Eventos do mapa
      map.on('error', (error) => {
        console.error('[MapBox Debug] Erro do mapa:', error);
        setMapError('Erro ao carregar o mapa. Verifique a chave Mapbox.');
      });

      map.on('load', () => {
        console.log('[MapBox Debug] Mapa carregado com sucesso');
        try {
          map.resize();
          if (hasCoords) {
            if (!markerRef.current) {
              markerRef.current = new mapboxgl.Marker().setLngLat(center as [number, number]).addTo(map);
            } else {
              markerRef.current.setLngLat(center as [number, number]);
            }
            setSelectedCoords({ lng: Number(company.longitude), lat: Number(company.latitude) });
          }
        } catch (loadError) {
          console.error('[MapBox Debug] Erro na configuração pós-carregamento:', loadError);
        }
      });

      map.on('sourcedata', (e) => {
        if (e.isSourceLoaded) {
          console.log('[MapBox Debug] Dados do mapa carregados');
        }
      });

      map.on('idle', () => {
        console.log('[MapBox Debug] Mapa em estado idle (pronto)');
      });

      // Resize após um pequeno delay
      setTimeout(() => {
        try {
          map.resize();
        } catch (resizeError) {
          console.warn('[MapBox Debug] Erro no resize:', resizeError);
        }
      }, 100);

      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        console.log('[MapBox Debug] Clique no mapa:', { lng, lat });
        setSelectedCoords({ lng, lat });
        if (!markerRef.current) {
          markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
        } else {
          markerRef.current.setLngLat([lng, lat]);
        }
      });

    } catch (e) {
      const errorMsg = 'Erro ao inicializar o mapa. Verifique a chave Mapbox.';
      console.error('[MapBox Debug] Erro geral na inicialização:', e);
      setMapError(errorMsg);
      toast({ 
        title: 'Erro do MapBox', 
        description: errorMsg, 
        variant: 'destructive' 
      });
    }

    return () => {
      console.log('[MapBox Debug] Limpando mapa');
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (removeError) {
          console.warn('[MapBox Debug] Erro ao remover mapa:', removeError);
        }
        mapRef.current = null;
      }
      if (geocoderContainerRef.current) {
        try { 
          geocoderContainerRef.current.innerHTML = ''; 
        } catch (cleanupError) {
          console.warn('[MapBox Debug] Erro na limpeza do geocoder:', cleanupError);
        }
      }
      markerRef.current = null;
      setSelectedCoords(null);
      setMapError(null);
    };
  }, [mapOpen, mPublicKey, company.longitude, company.latitude]);

  return (
    <div className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Configurações</h1>
      </header>
      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Negócio</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Usuários</TabsTrigger>}
        </TabsList>

        <TabsContent value="business">
          <div className="grid gap-4">
            {/* Empresa */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Empresa</h2>
                <Button onClick={saveCompany} disabled={cSaving || cLoading}>
                  {cSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : 'Salvar'}
                </Button>
              </div>
              {cLoading ? (
                <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Nome</Label>
                    <Input value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>CNPJ</Label>
                    <Input value={company.cnpj}
                      onChange={(e) => {
                        const masked = applyCNPJMask(e.target.value);
                        setCompany({ ...company, cnpj: masked });
                      }}
                      onBlur={() => {
                        if (company.cnpj && !isValidCNPJFormat(company.cnpj)) {
                          toast({ title: "CNPJ inválido", description: "Informe 14 dígitos.", variant: "destructive" });
                        }
                      }}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input value={company.phone}
                      onChange={(e) => {
                        const masked = applyPhoneMask(e.target.value);
                        setCompany({ ...company, phone: masked });
                      }}
                      onBlur={() => {
                        if (company.phone && !isValidPhoneFormat(company.phone)) {
                          toast({ title: "Telefone inválido", description: "Informe DDD + número (10 ou 11 dígitos).", variant: "destructive" });
                        }
                      }}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Cor institucional</Label>
                    <Input type="color" value={company.company_color} onChange={(e) => setCompany({ ...company, company_color: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 grid gap-3">
                    <Label>Logo</Label>
                    <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                      <div className="aspect-square rounded-md border overflow-hidden bg-muted">
                        {company.logo_url ? (
                          <img src={normalizeImageUrl(company.logo_url)} alt="logo" className="h-full w-full object-contain bg-white" />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">Sem logo</div>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">Upload do logo</Label>
                          <Input type="file" accept="image/*,.svg" onChange={onLogoFileChange} />
                          <p className="text-xs text-muted-foreground">Upload imediato (máx. 5MB). Redimensionado para 200x200 quando raster. Transparência preservada para PNG/WebP/SVG.</p>
                          {logoUploading && <p className="text-xs">Enviando logo...</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>CEP</Label>
                    <Input value={company.zip_code || ''} onChange={(e) => setCompany({ ...company, zip_code: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <Label>Endereço</Label>
                    <div className="relative">
                      <Textarea rows={2} value={company.address || ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
                      <Button type="button" size="sm" className="absolute right-2 bottom-2" variant="secondary" onClick={() => {
                        setMapOpen(true);
                      }} disabled={!mPublicKey || mPublicKeyLoading}>
                        <MapPin className="mr-1 h-4 w-4" /> Selecionar/Alterar
                      </Button>
                    </div>
                  </div>
                  {/* Latitude/Longitude ocultos no UI; valores continuam sendo mantidos no estado via mapa */}
                </div>
              )}
            </Card>

            {/* Horários de funcionamento */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Horário de funcionamento</h2>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Copiar de</Label>
                  <Select value={copySource} onValueChange={(v) => setCopySource(v as DayKey)}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Dia" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DAY_LABELS) as DayKey[]).map((d) => (
                        <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="secondary" onClick={() => copyToAllFrom(copySource)} disabled={!hours}>Copiar para todos</Button>
                  <Button onClick={saveHours} disabled={hoursSaving || hoursLoading || !hours}>
                    {hoursSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : 'Salvar horários'}
                  </Button>
                </div>
              </div>
              {hoursLoading ? (
                <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</div>
              ) : !hours ? (
                <div className="text-sm text-muted-foreground">Não foi possível carregar os horários.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {(Object.keys(DAY_LABELS) as DayKey[]).map((day) => {
                    const cfg = hours[day];
                    return (
                      <li key={day} className="py-2">
                        <div className="grid items-center gap-3 sm:grid-cols-2 md:grid-cols-[140px_110px_96px_96px]">
                          {/* Dia */}
                          <div className="font-medium whitespace-nowrap sm:col-span-2 md:col-span-1">{DAY_LABELS[day]}</div>

                          {/* Fechado */}
                          <div className="flex items-center gap-2 sm:col-span-2 md:col-span-1">
                            <span className="text-xs">Fechado</span>
                            <Switch checked={cfg.closed} onCheckedChange={(v) => updateDay(day, { closed: v })} />
                          </div>

                          {/* Abre/Fecha */}
                          {!cfg.closed && (
                            <div className="sm:col-span-2 md:contents flex gap-3">
                              {/* Abre */}
                              <div className="grid gap-1 md:contents">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground md:hidden">Abre</span>
                                <Input
                                  type="time"
                                  className="w-full md:w-24 text-center"
                                  aria-label="Abre"
                                  value={cfg.open}
                                  onChange={(e) => updateDay(day, { open: e.target.value })}
                                />
                              </div>
                              {/* Fecha */}
                              <div className="grid gap-1 md:contents">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground md:hidden">Fecha</span>
                                <Input
                                  type="time"
                                  className="w-full md:w-24 text-center"
                                  aria-label="Fecha"
                                  value={cfg.close}
                                  onChange={(e) => updateDay(day, { close: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Pausa de pedidos */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Pausa de pedidos</h2>
                <Button onClick={savePause} disabled={pauseSaving || pauseLoading}>
                  {pauseSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : 'Salvar'}
                </Button>
              </div>
              {pauseLoading ? (
                <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={pause.paused} onCheckedChange={(v) => setPause((p) => ({ ...p, paused: v }))} />
                    <span className="text-sm">{pause.paused ? 'Loja em pausa' : 'Loja ativa'}</span>
                  </div>
                  <div className="grid gap-2">
                    <Label>Mensagem exibida ao cliente</Label>
                    <Textarea value={pause.message} onChange={(e) => setPause((p) => ({ ...p, message: e.target.value }))} rows={3} />
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="marketing">
          <div className="text-sm text-muted-foreground">
            Conteúdo placeholder das configurações de marketing.
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid gap-4">
            {/* Métodos de pagamento */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Formas de Pagamento</h2>
                <Button onClick={savePayments} disabled={pSaving || pLoading}>
                  {pSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : 'Salvar'}
                </Button>
              </div>
              {pLoading ? (
                <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border rounded-md p-3">
                      <div>
                        <div className="font-medium">PIX</div>
                        <div className="text-xs text-muted-foreground">Chave: {payments.pix.key ? <span className="font-mono">{payments.pix.key}</span> : '—'}</div>
                      </div>
                      <Switch checked={payments.pix.enabled} onCheckedChange={(v) => setPayments((p) => ({ ...p, pix: { ...p.pix, enabled: v } }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Chave PIX</Label>
                      <Input value={payments.pix.key} onChange={(e) => setPayments((p) => ({ ...p, pix: { ...p.pix, key: e.target.value } }))} placeholder="Ex: cpf/email/aleatória" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border rounded-md p-3">
                      <div className="font-medium">Dinheiro</div>
                      <Switch checked={payments.cash.enabled} onCheckedChange={(v) => setPayments((p) => ({ ...p, cash: { enabled: v } }))} />
                    </div>
                    <div className="flex items-center justify-between border rounded-md p-3">
                      <div className="font-medium">Crédito</div>
                      <Switch checked={payments.credit.enabled} onCheckedChange={(v) => setPayments((p) => ({ ...p, credit: { enabled: v } }))} />
                    </div>
                    <div className="flex items-center justify-between border rounded-md p-3">
                      <div className="font-medium">Débito</div>
                      <Switch checked={payments.debit.enabled} onCheckedChange={(v) => setPayments((p) => ({ ...p, debit: { enabled: v } }))} />
                    </div>
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <Label>Observações</Label>
                    <Textarea rows={3} value={payments.notes || ''} onChange={(e) => setPayments((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
              )}
            </Card>

            {/* Mapbox */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Mapbox</h2>
                <Button onClick={saveMapboxKey} disabled={mSaving || !mNewKey.trim()}>
                  {mSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : 'Salvar chave'}
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center gap-2 text-sm">
                  {mLoading ? (
                    <span className="text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando chave...</span>
                  ) : mStatus?.exists ? (
                    <>
                      <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" /> Chave configurada</Badge>
                      <span className="text-muted-foreground">{mStatus?.masked}</span>
                    </>
                  ) : (
                    <>
                      <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Sem chave</Badge>
                      <span className="text-muted-foreground">Configure a chave pública</span>
                    </>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label>Nova chave pública</Label>
                  <Input value={mNewKey} onChange={(e) => setMNewKey(e.target.value)} placeholder="pk.XXX..." />
                </div>
                <div className="text-xs text-muted-foreground">
                  Chave pública atual para uso no mapa: {mPublicKeyLoading ? 'carregando...' : (mPublicKey ? <span className="font-mono">{mPublicKey}</span> : 'não disponível')}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {mApiStatusLoading ? (
                        <Badge variant="secondary" className="flex items-center"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Testando APIs...</Badge>
                      ) : mApiStatus ? (
                        <>
                          <Badge variant="outline" className={mApiStatus.geocoding.success ? 'bg-emerald-500 text-white border-transparent' : 'bg-red-500 text-white border-transparent'}>
                            {mApiStatus.geocoding.success ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />} Geocoding
                          </Badge>
                          <Badge variant="outline" className={mApiStatus.directions.success ? 'bg-emerald-500 text-white border-transparent' : 'bg-red-500 text-white border-transparent'}>
                            {mApiStatus.directions.success ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />} Directions
                          </Badge>
                          <Badge variant="outline" className={mApiStatus.maploads.success ? 'bg-emerald-500 text-white border-transparent' : 'bg-red-500 text-white border-transparent'}>
                            {mApiStatus.maploads.success ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />} Map Loads
                          </Badge>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Status das APIs não testado</span>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={checkMapboxApiStatus} disabled={mApiStatusLoading || mLoading}>
                      {mApiStatusLoading ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Testando...</>) : 'Testar APIs'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <div className="grid gap-4">
              <Card className="p-4">
                <UsersSection />
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog do mapa */}
      <Dialog open={mapOpen} onOpenChange={(o) => {
        setMapOpen(o);
        if (o) {
          // garantir resize ao reabrir com delay maior
          setTimeout(() => {
            try {
              if (mapRef.current) {
                mapRef.current.resize();
                console.log('[MapBox Debug] Mapa redimensionado após abertura');
              } else {
                // Se o mapa ainda não foi inicializado, aguardar mais um pouco
                forceMapResize();
              }
            } catch (resizeError) {
              console.warn('[MapBox Debug] Erro no resize ao reabrir:', resizeError);
            }
          }, 300); // Aumentar delay para 300ms
          
          // Forçar redimensionamento após um delay maior
          forceMapResize();
        }
        if (!o) {
          if (mapRef.current) { 
            try {
              mapRef.current.remove(); 
            } catch (removeError) {
              console.warn('[MapBox Debug] Erro ao remover mapa ao fechar:', removeError);
            }
            mapRef.current = null; 
          }
          markerRef.current = null;
          setSelectedCoords(null);
          setMapError(null);
        }
      }}>
        <DialogContent className="max-w-3xl z-50">
          <DialogHeader>
            <DialogTitle>Definir endereço no mapa</DialogTitle>
          </DialogHeader>
          
          {mapError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              <div className="font-medium">Erro no MapBox:</div>
              <div>{mapError}</div>
              <div className="mt-2 text-xs">
                Verifique se:
                <ul className="list-disc list-inside mt-1">
                  <li>A chave Mapbox está configurada corretamente</li>
                  <li>Sua conexão com a internet está funcionando</li>
                  <li>A chave não expirou ou não tem limites excedidos</li>
                </ul>
              </div>
            </div>
          )}
          
          <div ref={geocoderContainerRef} className="mb-2 relative z-10" style={{ position: 'relative', zIndex: 1 }} />
          <div 
            id="mapbox-container" 
            ref={mapContainerRef} 
            className="h-[400px] relative w-full" 
            style={{ position: 'relative', zIndex: 0, minHeight: '400px', height: '400px' }}
          >
            {!mPublicKey && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500 z-10">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div>Chave Mapbox não configurada</div>
                  <div className="text-sm">Configure a chave na aba Integrações</div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setMapOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={async () => {
              if (selectedCoords) {
                const { lng, lat } = selectedCoords;
                setCompany((c) => ({ ...c, latitude: lat, longitude: lng }));
                if (mPublicKey) {
                  try {
                    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=pt&access_token=${encodeURIComponent(mPublicKey)}`;
                    const resp = await fetch(url);
                    if (!resp.ok) {
                      throw new Error(`Erro na API: ${resp.status}`);
                    }
                    const data = await resp.json();
                    const feature = data?.features?.[0];
                    const place_name = feature?.place_name as string | undefined;
                    let zip: string | undefined = undefined;
                    const ctx = feature?.context;
                    if (Array.isArray(ctx)) {
                      const pc = ctx.find((c: any) => (c.id || '').startsWith('postcode'));
                      zip = pc?.text;
                    }
                    setCompany((c) => ({ ...c, address: place_name || c.address, zip_code: zip || c.zip_code }));
                  } catch (geoError) {
                    console.error('[MapBox Debug] Erro no geocoding reverso:', geoError);
                    toast({
                      title: 'Aviso',
                      description: 'Coordenadas salvas, mas não foi possível obter o endereço automaticamente.',
                      variant: 'default'
                    });
                  }
                }
              }
              setMapOpen(false);
            }} disabled={!selectedCoords}>
              Usar localização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersSection() {
  const { users, loading, error, search, setSearch, createUser, updateUser, deleteUser, refetch } = useUsers();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<null | { id: number; name: string; email: string; role: string }>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<null | { id: number; name: string }>(null);

  const [form, setForm] = useState({ name: "", email: "", role: "operator", password: "" });
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setForm({ name: "", email: "", role: "operator", password: "" });
  }

  function roleLabel(r: string) {
    switch (r) {
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'operator': return 'Atendente';
      case 'delivery': return 'Entregador';
      case 'kitchen': return 'Cozinha';
      default: return r;
    }
  }

  function allowedRoleOptions() {
    // Backend aceita admin/manager/operator/delivery/kitchen.
    return [
      { value: 'admin', label: 'Administrador' },
      { value: 'manager', label: 'Gerente' },
      { value: 'operator', label: 'Atendente' },
      { value: 'delivery', label: 'Entregador' },
      { value: 'kitchen', label: 'Cozinha' },
    ];
  }

  function onNew() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  function onEdit(u: { id: number; name: string; email: string; role: string }) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, password: "" });
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { name: form.name.trim(), email: form.email.trim(), role: form.role };
      if (editing) {
        if (form.password && form.password.length > 0) payload.password = form.password;
        const r = await updateUser(editing.id, payload);
        if (!r.success) throw new Error(r.message);
        toast({ title: 'Usuário atualizado', description: r.message || 'Sucesso' });
      } else {
        if (!form.password || form.password.length < 6) {
          throw new Error('Senha obrigatória com no mínimo 6 caracteres');
        }
        payload.password = form.password;
        const r = await createUser(payload);
        if (!r.success) throw new Error(r.message);
        toast({ title: 'Usuário criado', description: r.message || 'Sucesso' });
      }
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha na operação', variant: 'destructive' as any });
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    if (!confirmingDelete) return;
    const { id } = confirmingDelete;
    try {
      const r = await deleteUser(id);
      if (!r.success) throw new Error(r.message);
      toast({ title: 'Usuário excluído', description: r.message || 'Sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message || 'Falha ao excluir', variant: 'destructive' as any });
    } finally {
      setConfirmingDelete(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Usuários</h2>
        <Button onClick={onNew}>Novo usuário</Button>
      </div>

      <div className="flex items-center gap-2">
        <Input placeholder="Buscar por nome, email ou perfil" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="secondary" onClick={() => refetch()} disabled={loading}>
          {loading ? 'Atualizando...' : 'Recarregar'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="w-[1%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{roleLabel(u.role)}</TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(u)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete({ id: u.id, name: u.name })}>Excluir</Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Nenhum usuário encontrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="u-name">Nome</Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoleOptions().map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u-pass">Senha {editing ? "(deixe em branco para manter)" : "(mín. 6 caracteres)"}</Label>
              <Input id="u-pass" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={editing ? "" : "******"} />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => { setOpen(false); }} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : (editing ? 'Salvar alterações' : 'Criar usuário')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmingDelete} onOpenChange={(o) => { if (!o) setConfirmingDelete(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <span className="font-medium">{confirmingDelete?.name}</span>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmingDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={onConfirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

