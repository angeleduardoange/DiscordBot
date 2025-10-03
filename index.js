import fs from "fs";
import schedule from "node-schedule";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

const DB_FILE = "./db.json";

// --- DB inicial ---
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }
  return { examenes: {}, mensajesPersonalizados: {}, canalId: null };
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// --- Horarios fijos ---
const horarios = {
  lunes: `
De 7:00 a 8:20: Matemáticas
De 8:20 a 9:40: Arte y patrimonio
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: Ciencias naturales
De 11:30 a 12:50 (1r grupo): Computación
De 11:30 a 12:50 (2do grupo): Dibujo técnico
De 12:50 a 2:10 (1r grupo): Dibujo Técnico
De 12:50 a 2:10 (2do grupo): Deporte`,
  martes: `
De 7:00 a 8:20: Orientación
De 8:20 a 9:40 (1r grupo): Deporte
De 8:20 a 9:40 (2do grupo): Practica Ciencias naturales
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: GHC
De 11:30 a 12:50: Matemáticas
De 12:50 a 2:10: Arte y patrimonio`,
  miercoles: `
De 7:00 a 8:20: GHC
De 8:20 a 9:40: Castellano
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: Italiano
De 11:30 a 12:50: Musica
De 12:50 a 2:10 (1r grupo): Dibujo técnico
De 12:50 a 2:10 (2do grupo): Computación`,
  miercolesAlterno: `
De 7:00 a 8:20: GHC
De 8:20 a 9:40: Castellano
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: Italiano
De 11:30 a 12:50: Musica
De 12:50 a 2:10 (1r grupo): Computación
De 12:50 a 2:10 (2do grupo): Dibujo técnico`,
  jueves: `(No hay clases)`,
  viernes: `
De 7:00 a 8:20: Castellano
De 8:20 a 9:40: GHC
De 9:40 a 10:10: Recreo
De 10:10 a 11:30 (1r grupo): Inglés
De 10:10 a 11:30 (2do grupo): Guiatura
De 11:30 a 12:50: Inglés
De 12:50 a 2:10 (1r grupo): Practica Ciencias naturales
De 12:50 a 2:10 (2do grupo): Computación`,
};

// --- Función de mensajes diarios ---
function getDiaSemana(fecha) {
  return fecha.toLocaleDateString("es-ES", { weekday: "long" });
}

function getSemanaNumero(fecha) {
  const start = new Date(fecha.getFullYear(), 0, 1);
  const diff =
    (fecha -
      start +
      (start.getTimezoneOffset() - fecha.getTimezoneOffset()) * 60000) /
    86400000;
  return Math.floor((diff + start.getDay() + 1) / 7);
}

function generarMensajeHoy() {
  const hoy = new Date();
  const fechaStr = hoy.toLocaleDateString("es-ES");

  const dia = getDiaSemana(hoy).toLowerCase();
  const semana = getSemanaNumero(hoy);

  // Elegir horario correcto
  let horario;
  if (dia === "miércoles") {
    horario =
      semana % 2 === 0 ? horarios.miercoles : horarios.miercolesAlterno;
  } else {
    horario = horarios[dia] || "(No hay clases)";
  }

  // Exámenes
  const examenes = db.examenes[fechaStr] || [];

  // Mensajes personalizados
  const mensajeExtra = db.mensajesPersonalizados[fechaStr] || "";

  let texto = `📅 @everyone Hoy es ${dia} (${fechaStr})\n\nHorario:\n${horario}\n\nExámenes: ${
    examenes.length > 0 ? examenes.join(", ") : "Ninguno"
  }`;
  if (mensajeExtra) texto += `\n\n📝 Nota: ${mensajeExtra}`;
  return texto;
}

async function enviarMensajeDiario() {
  if (!db.canalId) return;
  const canal = await client.channels.fetch(db.canalId);
  if (canal) canal.send(generarMensajeHoy());
}

// --- Enviar a las 5 AM ---
schedule.scheduleJob("0 5 * * *", enviarMensajeDiario);

// --- Slash Commands ---
const commands = [
  {
    name: "horario",
    description: "Muestra el horario de hoy",
  },
  {
    name: "examen",
    description: "Agrega un examen",
    options: [
      {
        name: "materia",
        type: 3,
        description: "Materia del examen",
        required: true,
      },
      {
        name: "fecha",
        type: 3,
        description: "Fecha en formato DD/MM/YY",
        required: true,
      },
    ],
  },
  {
    name: "removerexamen",
    description: "Elimina un examen de una fecha",
    options: [
      {
        name: "fecha",
        type: 3,
        description: "Fecha del examen (DD/MM/YY)",
        required: true,
      },
    ],
  },
  {
    name: "setcanal",
    description: "Configura el canal para los mensajes diarios",
    options: [
      {
        name: "canal",
        type: 7, // CHANNEL
        description: "Canal donde enviar los mensajes",
        required: true,
      },
    ],
  },
];

// Registrar comandos
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log("🔄 Registrando comandos...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ Comandos registrados.");
  } catch (error) {
    console.error(error);
  }
})();

// --- Respuesta a comandos ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === "horario") {
    await interaction.reply(generarMensajeHoy());
  }

  if (commandName === "examen") {
    const materia = options.getString("materia");
    const fecha = options.getString("fecha");

    if (!/^\d{2}\/\d{2}\/\d{2}$/.test(fecha)) {
      return interaction.reply("⚠️ Usa el formato DD/MM/YY.");
    }

    if (!db.examenes[fecha]) db.examenes[fecha] = [];
    db.examenes[fecha].push(materia);
    saveDB(db);

    await interaction.reply(`📚 Examen de ${materia} agregado para el ${fecha}`);
  }

  if (commandName === "removerexamen") {
    const fecha = options.getString("fecha");

    if (!db.examenes[fecha]) {
      return interaction.reply("⚠️ No hay exámenes en esa fecha.");
    }

    delete db.examenes[fecha];
    saveDB(db);

    await interaction.reply(`🗑️ Exámenes eliminados para el ${fecha}`);
  }

  if (commandName === "setcanal") {
    const canal = options.getChannel("canal");
    db.canalId = canal.id;
    saveDB(db);

    await interaction.reply(`✅ Canal configurado: ${canal}`);
  }
});

// --- Ready ---
client.once("clientReady", () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
});

client.login(process.env.TOKEN);
