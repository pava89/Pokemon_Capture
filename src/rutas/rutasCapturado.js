const express = require('express');
const enrutador = express.Router();
const pokemonCapturado = require('../controladores/capturadoControlador');

enrutador.post('/capturar', pokemonCapturado.capturarPokemon);
enrutador.get('/listar/:usuarioCedula', pokemonCapturado.listarPokemonesUsuario);

module.exports = enrutador;