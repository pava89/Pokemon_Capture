const { Capturado, Pokemon } = require('../baseDatos');

function obtenerRarezaPorPokemon(pokemonId) {
  if (pokemonId <= 25) return { rareza: 'común', probabilidad: 0.85 };
  if (pokemonId <= 75) return { rareza: 'normal', probabilidad: 0.65 };
  if (pokemonId <= 130) return { rareza: 'raro', probabilidad: 0.40 };
  return { rareza: 'legendario', probabilidad: 0.20 };
}

const capturarPokemon = async (req, res) => {
  try {
    const pokemonId = Number(req.body.pokemonId);
    const usuarioCedula = String(req.body.usuarioCedula ?? '').trim();

    if (!pokemonId || !usuarioCedula) {
      return res.status(400).json({
        mensaje: 'Faltan datos para capturar',
        resultado: null
      });
    }

    const existente = await Capturado.findOne({
      where: { pokemonId, usuarioCedula }
    });

    if (existente) {
      return res.status(409).json({
        mensaje: 'Ya capturaste este Pokémon',
        resultado: existente
      });
    }

    const pokemon = await Pokemon.findByPk(pokemonId);
    if (!pokemon) {
      return res.status(404).json({
        mensaje: 'El Pokémon no existe en la base de datos',
        resultado: null
      });
    }

    const meta = obtenerRarezaPorPokemon(pokemon.id);
    const suerte = Math.random();

    if (suerte > meta.probabilidad) {
      return res.status(409).json({
        mensaje: `La captura falló. Pokémon ${meta.rareza}. Intenta de nuevo.`,
        resultado: null,
        meta
      });
    }

    const capturado = await Capturado.create({
      pokemonId,
      usuarioCedula
    });

    return res.status(201).json({
      mensaje: '¡Pokémon capturado!',
      resultado: capturado,
      meta
    });
  } catch (error) {
    return res.status(400).json({
      mensaje: error.message,
      resultado: null
    });
  }
};

const listarPokemonesUsuario = async (req, res) => {
  try {
    const { usuarioCedula } = req.params;
    const pokemones = await Capturado.findAll({ where: { usuarioCedula } });
    res.status(200).json({
      mensaje: 'Lista de Pokémon capturados',
      resultado: pokemones
    });
  } catch (error) {
    res.status(400).json({ mensaje: error.message, resultado: null });
  }
};

module.exports = {
  capturarPokemon,
  listarPokemonesUsuario
};