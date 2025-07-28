require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

app.post('/avaliar', async (req, res) => {
  const { endereco } = req.body;

  if (!endereco) {
    return res.status(400).json({ erro: 'Endereço não fornecido' });
  }

  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${key}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(400).json({ erro: 'Endereço inválido ou não encontrado' });
    }

    const local = data.results[0].geometry.location;
    const bairro = data.results[0].address_components.find(c => c.types.includes("sublocality") || c.types.includes("neighborhood"));

    const avaliacao = {
      endereco_formatado: data.results[0].formatted_address,
      latitude: local.lat,
      longitude: local.lng,
      bairro: bairro?.long_name || "Não identificado",
      score: Math.random().toFixed(2)
    };

    res.json(avaliacao);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API ouvindo na porta ${PORT}`);
});
