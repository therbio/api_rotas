require('dotenv').config();
const fs = require('fs');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const AJUSTE = 0.8;
const LAT_UBER = -19.985669376094865;
const LNG_UBER = -43.99931080220224;

function carregar(file) {
    try {
        if (fs.existsSync(file)) {
            const rawData = fs.readFileSync(file, 'utf8');
            if (rawData.trim()) {
                return JSON.parse(rawData);
            }
        } else {
            console.error("Arquivo não encontrado:", file);
        }
    } catch (error) {
        console.error("Erro ao carregar arquivo:", error);
    }
    return [{}];
}

const geral = carregar("geral.json");
const indice = Object.keys(geral[0] || {}).length;

function toRad(deg) {
    return deg * Math.PI / 180;
}

function Distancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function goodrota(destino) {
    if (!destino?.lat || !destino?.lng) return false;

    const uber_destino = Distancia(LAT_UBER, LNG_UBER, destino.lat, destino.lng);
    if (uber_destino === 0) return true;

    for (let j = 0; j < indice; j++) {
        const referencia = geral[0][j];
        if (!referencia?.lat || !referencia?.lng) continue;

        const uber_ponto = Distancia(LAT_UBER, LNG_UBER, referencia.lat, referencia.lng);
        const destino_ponto = Distancia(destino.lat, destino.lng, referencia.lat, referencia.lng);

        let busca = uber_ponto * AJUSTE;
        if (referencia?.prox !== undefined) {
            busca = uber_ponto * (referencia.prox / 100);
        }

        if (busca > 0 && destino_ponto <= busca && uber_destino <= uber_ponto) {
            if (destino?.dados?.destino || !destino?.dados) {
                return true;
            }
        }
    }

    return false;
}

// ⬇ Função para registrar log no arquivo log.json
function registrarLog(dados) {
    const logFile = 'log.json';
    let historico = [];

    try {
        if (fs.existsSync(logFile)) {
            const raw = fs.readFileSync(logFile, 'utf8');
            if (raw.trim()) {
                historico = JSON.parse(raw);
            }
        }
    } catch (e) {
        console.error("Erro ao ler log:", e);
    }

    historico.push({ ...dados, timestamp: new Date().toISOString() });

    try {
        fs.writeFileSync(logFile, JSON.stringify(historico, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar log:", e);
    }
}

app.post('/avaliar', async (req, res) => {
    const { endereco } = req.body;

    if (!endereco) {
        return res.status(400).json({ erro: 'Endereço não fornecido' });
    }

    try {
        const key = process.env.GOOGLE_MAPS_API_KEY;
        if (!key) {
            return res.status(500).json({ erro: 'Chave da API não configurada' });
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${key}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            return res.status(400).json({ erro: 'Endereço inválido ou não encontrado' });
        }

        const local = data.results[0].geometry.location;
        const rotaValida = goodrota(local);

        const avaliacao = {
            endereco_original: endereco,
            endereco_formatado: data.results[0].formatted_address,
            latitude: local.lat,
            longitude: local.lng,
            rota: rotaValida
        };

        // 🔹 Salvar no log
        registrarLog(avaliacao);

        res.json(avaliacao);
    } catch (err) {
        console.error('Erro interno:', err);
        res.status(500).json({ erro: 'Erro interno ao avaliar endereço' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API ouvindo na porta ${PORT}`);
});
