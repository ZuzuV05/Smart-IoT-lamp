import { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, LightbulbOff, Power, PowerOff, 
  Thermometer, Droplets, Activity, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Declare MQTT from CDN
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
      return [...prev, newLog].slice(-50); // Keep last 50 logs, store in ascending order
    });
  };

  useEffect(() => {
    // Scroll to bottom of logs
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!window.mqtt) {
      console.error("MQTT SDK is missing. Make sure the script was loaded from unpkg.");
      return;
    }

    // Connect to HiveMQ public broker via WebSocket
    const mqttOptions = {
      keepalive: 60,
      clientId: 'web_' + Math.random().toString(16).slice(2, 8),
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    };
    
    console.log("Menghubungkan ke MQTT Broker...");
    const mqttClient = window.mqtt.connect('wss://broker.hivemq.com:8884/mqtt', mqttOptions);
    
    mqttClient.on('connect', () => {
      console.log('Terhubung ke MQTT Broker');
      setConnected('terhubung');
      mqttClient.subscribe('smarthome/relay');
      mqttClient.subscribe('smarthome/sensor');
      addLog('Sistem terhubung ke MQTT Broker.');
    });

    mqttClient.on('reconnect', () => {
      setConnected('menghubungkan');
    });

    mqttClient.on('error', (err: any) => {
      console.error('MQTT Error: ', err);
      // setConnected('terputus');
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
      } 
      else if (topic === 'smarthome/relay') {
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
                // Only log if state changed (avoid duplicate spam from echoes)
                if (updated[idx] !== isOn) {
                  addLog(`Lampu ${idx + 1} ${isOn ? 'dinyalakan' : 'dimatikan'}`);
                }
                updated[idx] = isOn;
                return updated;
              });
            }
          }
        }
      }
    });

    setClient(mqttClient);

    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, []);

  const sendCommand = (cmd: string) => {
    if (client && connected === 'terhubung') {
      client.publish('smarthome/relay', cmd);
    } else {
      addLog('Gagal mengirim: terputus dari server');
    }
  };

  const toggleRelay = (index: number) => {
    const currentState = relays[index];
    const cmd = `relay${index + 1}_${currentState ? 'off' : 'on'}`;
    sendCommand(cmd);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-2xl font-semibold text-white">IoT Smart Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Kendali terpusat</p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center px-4 py-2 rounded-full bg-gray-950 border border-gray-800">
            <span className="relative flex h-3 w-3 mr-3">
              {connected === 'terhubung' && (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </>
              )}
              {connected === 'menghubungkan' && (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 animate-pulse"></span>
              )}
              {connected === 'terputus' && (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              )}
            </span>
            <span className="text-sm font-medium capitalize">
              {connected}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Controls Panel (Left, 2 cols) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Sensors View */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex items-center space-x-4">
                <div className="p-4 bg-orange-500/10 rounded-xl text-orange-400 shrink-0">
                  <Thermometer className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm font-medium">Suhu Ruangan</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {temperature !== '--' ? `${temperature}°C` : '--'}
                  </p>
                </div>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex items-center space-x-4">
                <div className="p-4 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                  <Droplets className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm font-medium">Kelembapan</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {humidity !== '--' ? `${humidity}%` : '--'}
                  </p>
                </div>
              </div>
            </section>

            {/* Relay Grids */}
            <section className="bg-gray-900 p-6 md:p-8 rounded-2xl border border-gray-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h2 className="text-xl font-medium text-white mb-4 sm:mb-0">Kendali Lampu</h2>
                <div className="flex gap-3">
                  <button 
                    onClick={() => sendCommand('all_on')}
                    className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Power className="w-4 h-4" />
                    <span>Nyalakan Semua</span>
                  </button>
                  <button 
                    onClick={() => sendCommand('all_off')}
                    className="flex items-center space-x-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <PowerOff className="w-4 h-4" />
                    <span>Matikan Semua</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relays.map((isOn, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleRelay(idx)}
                    className={`relative flex flex-col items-center justify-center p-6 border rounded-xl transition-all ${
                      isOn 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                  >
                    <motion.div
                      animate={{ scale: isOn ? 1.1 : 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="mb-4"
                    >
                      {isOn ? <Lightbulb className="w-10 h-10 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" /> : <LightbulbOff className="w-10 h-10" />}
                    </motion.div>
                    <span className="font-semibold text-gray-200">Lampu {idx + 1}</span>
                    <span className="font-mono text-xs mt-2 uppercase px-2 py-1 bg-gray-950 rounded-md shadow-inner">
                      {isOn ? 'ON' : 'OFF'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Logs Panel (Right, 1 col) */}
          <div className="space-y-6 flex flex-col h-full">
            
            {/* Activity Log */}
            <section className="bg-gray-900 border border-gray-800 rounded-2xl flex-1 min-h-[300px] flex flex-col h-[600px]">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-gray-400" />
                  <h3 className="font-medium text-white">Log Aktivitas</h3>
                </div>
                <span className="text-xs text-gray-500 font-mono tracking-wider">MQTT</span>
              </div>
              
              <div className="flex-1 p-5 overflow-y-auto w-full">
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex space-x-3 text-sm pb-3 border-b border-gray-800/50 last:border-0"
                      >
                        <span className="text-gray-500 font-mono shrink-0">[{log.time}]</span>
                        <span className="text-gray-300 break-words">{log.message}</span>
                      </motion.div>
                    ))}
                    {logs.length === 0 && (
                      <div className="text-gray-600 text-center text-sm py-8 italic flex flex-col items-center">
                        <AlertCircle className="w-6 h-6 mb-2 opacity-50" />
                        Belum ada aktivitas tercatat
                      </div>
                    )}
                  </AnimatePresence>
                  <div ref={logsEndRef} />
                </div>
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
