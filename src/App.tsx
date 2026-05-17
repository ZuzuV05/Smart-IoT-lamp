import { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, LightbulbOff, Power, PowerOff, 
  Thermometer, Droplets, Activity, AlertCircle
} from 'lucide-react';

declare global {
  interface Window {
    mqtt: any;
  }
}

type LogEntry = {
  id: string;
  time: string;
  message: string;
};

export default function App() {
  const [client, setClient] = useState<any>(null);
  const [connected, setConnected] = useState<'menghubungkan' | 'terhubung' | 'terputus'>('menghubungkan');
  const [temperature, setTemperature] = useState<string>('--');
  const [humidity, setHumidity] = useState<string>('--');
  const [relays, setRelays] = useState([false, false, false, false]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string) => {
    setLogs(prev => {
      const newLog = {
        id: Math.random().toString(36).substring(7),
        time: new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
        message
      };
      return [...prev, newLog].slice(-50);
    });
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!window.mqtt) {
      console.error("MQTT SDK is missing.");
      return;
    }

    const mqttOptions = {
      keepalive: 60,
      clientId: 'web_' + Math.random().toString(16).slice(2, 8),
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    };

    const mqttClient = window.mqtt.connect('wss://broker.hivemq.com:8884/mqtt', mqttOptions);

    mqttClient.on('connect', () => {
      setConnected('terhubung');
      mqttClient.subscribe('smarthome/relay');
      mqttClient.subscribe('smarthome/sensor');
      addLog('Sistem terhubung ke MQTT Broker.');
    });

    mqttClient.on('reconnect', () => {
      setConnected('menghubungkan');
    });

    mqttClient.on('error', (err: any) => {
      const errMsg = err && err.message ? err.message : String(err);
      if (errMsg.includes('client disconnecting') || errMsg.includes('close')) return;
      console.error('MQTT Error: ', err);
    });

    mqttClient.on('offline', () => {
      setConnected('terputus');
    });

    mqttClient.on('message', (topic: string, message: Buffer) => {
      const payload = message.toString();

      if (topic === 'smarthome/sensor') {
        const tempMatch = payload.match(/Suhu:\s*([\d.]+)/i);
        const humMatch = payload.match(/Kelembapan:\s*([\d.]+)/i);
        if (tempMatch && tempMatch[1]) setTemperature(tempMatch[1]);
        if (humMatch && humMatch[1]) setHumidity(humMatch[1]);
      } else if (topic === 'smarthome/relay') {
        const cmd = payload.trim().toLowerCase();
        if (cmd === 'all_on') {
          setRelays([true, true, true, true]);
          addLog('Semua lampu DINYALAKAN');
        } else if (cmd === 'all_off') {
          setRelays([false, false, false, false]);
          addLog('Semua lampu DIMATIKAN');
        } else if (cmd.startsWith('relay') && (cmd.endsWith('_on') || cmd.endsWith('_off'))) {
          const numMatch = cmd.match(/relay(\d)_/);
          if (numMatch) {
            const idx = parseInt(numMatch[1], 10) - 1;
            const isOn = cmd.endsWith('_on');
            if (idx >= 0 && idx < 4) {
              setRelays(prev => {
                const updated = [...prev];
                if (updated[idx] !== isOn) addLog(`Lampu ${idx + 1} ${isOn ? 'dinyalakan' : 'dimatikan'}`);
                updated[idx] = isOn;
                return updated;
              });
            }
          }
        }
      }
    });

    setClient(mqttClient);
    return () => { if (mqttClient) mqttClient.end(); };
  }, []);

  const sendCommand = (cmd: string) => {
    if (client && connected === 'terhubung') {
      client.publish('smarthome/relay', cmd);
    } else {
      addLog('Gagal mengirim: terputus dari server');
    }
  };

  const toggleRelay = (index: number) => {
    const cmd = `relay${index + 1}_${relays[index] ? 'off' : 'on'}`;
    sendCommand(cmd);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '24px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Header */}
        <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '24px', backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#ffffff', margin: 0 }}>IoT Smart Dashboard</h1>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>Kendali terpusat</p>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '9999px', backgroundColor: '#0a0a0a', border: '1px solid #262626' }}>
            <span style={{ display: 'inline-flex', height: '12px', width: '12px', borderRadius: '50%', marginRight: '12px', backgroundColor: connected === 'terhubung' ? '#10b981' : connected === 'menghubungkan' ? '#eab308' : '#ef4444' }}></span>
            <span style={{ fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>{connected}</span>
          </div>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>

          {/* Main Panel */}
          <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Sensor */}
            <section style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', backgroundColor: '#171717', padding: '24px', borderRadius: '16px', border: '1px solid #262626', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: '12px', color: '#fb923c', flexShrink: 0 }}>
                  <Thermometer size={32} />
                </div>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Suhu Ruangan</p>
                  <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0' }}>{temperature !== '--' ? `${temperature}°C` : '--'}</p>
                </div>
              </div>
              <div style={{ flex: '1 1 200px', backgroundColor: '#171717', padding: '24px', borderRadius: '16px', border: '1px solid #262626', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: '12px', color: '#60a5fa', flexShrink: 0 }}>
                  <Droplets size={32} />
                </div>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Kelembapan</p>
                  <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0' }}>{humidity !== '--' ? `${humidity}%` : '--'}</p>
                </div>
              </div>
            </section>

            {/* Relay */}
            <section style={{ backgroundColor: '#171717', padding: '32px', borderRadius: '16px', border: '1px solid #262626' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#ffffff', margin: 0 }}>Kendali Lampu</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => sendCommand('all_on')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '8px 16px', borderRadius: '8px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
                    <Power size={16} /><span>Nyalakan Semua</span>
                  </button>
                  <button onClick={() => sendCommand('all_off')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '8px 16px', borderRadius: '8px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
                    <PowerOff size={16} /><span>Matikan Semua</span>
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                {relays.map((isOn, idx) => (
                  <button key={idx} onClick={() => toggleRelay(idx)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', border: isOn ? '1px solid rgba(245,158,11,0.3)' : '1px solid #374151', borderRadius: '12px', backgroundColor: isOn ? 'rgba(245,158,11,0.1)' : 'rgba(31,41,55,0.5)', color: isOn ? '#f59e0b' : '#9ca3af', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ marginBottom: '16px' }}>
                      {isOn ? <Lightbulb size={40} style={{ filter: 'drop-shadow(0 0 15px rgba(245,158,11,0.5))' }} /> : <LightbulbOff size={40} />}
                    </div>
                    <span style={{ fontWeight: '600', color: '#e5e7eb' }}>Lampu {idx + 1}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', marginTop: '8px', textTransform: 'uppercase', padding: '4px 8px', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
                      {isOn ? 'ON' : 'OFF'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Log Panel */}
          <div style={{ flex: '1 1 30%' }}>
            <section style={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '600px' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Activity size={20} color="#9ca3af" />
                  <h3 style={{ fontWeight: '500', color: '#ffffff', margin: 0 }}>Log Aktivitas</h3>
                </div>
                <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>MQTT</span>
              </div>
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#4b5563', textAlign: 'center', fontSize: '14px', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <AlertCircle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    Belum ada aktivitas tercatat
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '12px', fontSize: '14px', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(38,38,38,0.5)' }}>
                      <span style={{ color: '#6b7280', fontFamily: 'monospace', flexShrink: 0 }}>[{log.time}]</span>
                      <span style={{ color: '#d1d5db', wordBreak: 'break-word' }}>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
