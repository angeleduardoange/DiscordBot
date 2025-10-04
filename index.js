// index.js (ESM)
import fs from "fs";
import schedule from "node-schedule";
import moment from "moment-timezone";
import dotenv from "dotenv";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
} from "discord.js";

dotenv.config();
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ Faltan variables de entorno. Define TOKEN, CLIENT_ID y GUILD_ID.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

const DB_FILE = "./db.json";

// ----- DB helpers -----
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (e) {
      console.error("⚠️ Error leyendo db.json, se resetea:", e);
    }
  }
  return { examenes: {}, mensajesPersonalizados: {}, canalId: null };
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let db = loadDB();

// ----- Fecha consistente DD/MM/YY -----
function dateKeyFromDate(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// ----- Horarios (fijos, con miércoles alterno) -----
const horarios = {
  lunes: `De 7:00 a 8:20: Matemáticas
De 8:20 a 9:40: Arte y patrimonio
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: Ciencias naturales
De 11:30 a 12:50 (1r grupo): Computación
De 11:30 a 12:50 (2do grupo): Dibujo técnico
De 12:50 a 2:10 (1r grupo): Dibujo Técnico
De 12:50 a 2:10 (2do grupo): Deporte`,

  martes: `De 7:00 a 8:20: Orientación
De 8:20 a 9:40 (1r grupo): Deporte
De 8:20 a 9:40 (2do grupo): Practica Ciencias naturales
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: GHC
De 11:30 a 12:50: Matemáticas
De 12:50 a 2:10: Arte y patrimonio`,

  miercoles: `De 7:00 a 8:20: GHC
De 8:20 a 9:40: Castellano
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: Italiano
De 11:30 a 12:50: Música
De 12:50 a 2:10 (1r grupo): Dibujo técnico
De 12:50 a 2:10 (2do grupo): Computación`,

  miercolesAlterno: `De 7:00 a 8:20: GHC
De 8:20 a 9:40: Castellano
De 9:40 a 10:10: Recreo
De 10:10 a 11:30: Italiano
De 11:30 a 12:50: Música
De 12:50 a 2:10 (1r grupo): Computación
De 12:50 a 2:10 (2do grupo): Dibujo técnico`,

  jueves: `(No hay clases)`,

  viernes: `De 7:00 a 8:20: Castellano
De 8:20 a 9:40: GHC
De 9:40 a 10:10: Recreo
De 10:10 a 11:30 (1r grupo): Inglés
De 10:10 a 11:30 (2do grupo): Guiatura
De 11:30 a 12:50: Inglés
De 12:50 a 2:10 (1r grupo): Practica Ciencias naturales
De 12:50 a 2:10 (2do grupo): Computación`,
};

// ----- Generar mensaje del día -----
function getSemanaNumero(fecha) {
  const start = new Date(fecha.getFullYear(), 0, 1);
  const diff = (fecha - start + (start.getTimezoneOffset() - fecha.getTimezoneOffset()) * 60000) / 86400000;
  return Math.floor((diff + start.getDay() + 1) / 7);
}

function generarMensajeParaFecha(fechaObj = new Date()) {
  const fechaKey = dateKeyFromDate(fechaObj);
  const dia = fechaObj.toLocaleDateString("es-ES", { weekday: "long" }).toLowerCase();
  const semana = getSemanaNumero(fechaObj);

  let horario;
  if (dia === "miércoles" || dia === "miercoles") {
    horario = semana % 2 === 0 ? horarios.miercoles : horarios.miercolesAlterno;
  } else {
    horario = horarios[dia] || "(No hay clases)";
  }

  const examenes = db.examenes[fechaKey] || [];
  const nota = db.mensajesPersonalizados[fechaKey] || "";

  let texto = `📅 Hoy es ${dia} (${fechaKey})\n\nHorario:\n${horario}\n\nExámenes: ${examenes.length > 0 ? examenes.join(", ") : "Ninguno"}`;
  if (nota) texto += `\n\n📝 Nota: ${nota}`;
  return texto;
}

// ----- Envío diario -----
async function enviarMensajeDiario() {
  if (!db.canalId) {
    console.log("⚠️ No hay canal configurado en la base de datos (db.canalId).");
    return;
  }
  const canalId = String(db.canalId);
  try {
    const canal = await client.channels.fetch(canalId);
    if (!canal) {
      console.log("❌ Canal no encontrado (fetch devolvió null). ID:", canalId);
      return;
    }

    try {
      const perms = canal.permissionsFor(client.user);
      if (perms && !perms.has(PermissionsBitField.Flags.SendMessages)) {
        console.log("❌ El bot no tiene permiso de enviar mensajes en el canal:", canalId);
        return;
      }
    } catch {}

    const texto = generarMensajeParaFecha(new Date());
    await canal.send(texto);
    console.log("✅ Mensaje diario enviado en canal:", canalId);
  } catch (err) {
    console.error("❌ Error enviando mensaje diario:", err);
  }
}

// ----- Slash commands -----
const commands = [
  new SlashCommandBuilder()
    .setName("horario")
    .setDescription("Establece un mensaje personalizado para una fecha (DD/MM/YY)")
    .addStringOption((o) => o.setName("fecha").setDescription("DD/MM/YY").setRequired(true))
    .addStringOption((o) => o.setName("texto").setDescription("Texto para esa fecha").setRequired(true)),

  new SlashCommandBuilder()
    .setName("examen")
    .setDescription("Añade un examen para una fecha (DD/MM/YY)")
    .addStringOption((o) => o.setName("fecha").setDescription("DD/MM/YY").setRequired(true))
    .addStringOption((o) => o.setName("materia").setDescription("Nombre de la materia").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerhorario")
    .setDescription("Elimina el mensaje personalizado de una fecha")
    .addStringOption((o) => o.setName("fecha").setDescription("DD/MM/YY").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerexamen")
    .setDescription("Remueve una materia de una fecha (DD/MM/YY)")
    .addStringOption((o) => o.setName("fecha").setDescription("DD/MM/YY").setRequired(true))
    .addStringOption((o) => o.setName("materia").setDescription("Materia a remover").setRequired(true)),

  new SlashCommandBuilder()
    .setName("setcanal")
    .setDescription("Configura el canal donde se enviarán los mensajes diarios")
    .addChannelOption((o) => o.setName("canal").setDescription("Selecciona el canal").addChannelTypes(ChannelType.GuildText).setRequired(true)),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔄 Registrando comandos en el servidor...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Comandos registrados.");
  } catch (err) {
    console.error("❌ Error registrando comandos:", err);
  }
})();

// ----- Interacciones -----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  await interaction.deferReply({ ephemeral: true });

  try {
    const name = interaction.commandName;

    if (name === "horario") {
      const fecha = interaction.options.getString("fecha");
      const texto = interaction.options.getString("texto");
      if (!/^\d{2}\/\d{2}\/\d{2}$/.test(fecha))
        return interaction.editReply("⚠️ Formato inválido. Usa DD/MM/YY");

      db.mensajesPersonalizados[fecha] = texto;
      saveDB(db);
      return interaction.editReply(`✅ Mensaje personalizado guardado para ${fecha}`);
    }

    if (name === "examen") {
      const fecha = interaction.options.getString("fecha");
      const materia = interaction.options.getString("materia");
      if (!/^\d{2}\/\d{2}\/\d{2}$/.test(fecha))
        return interaction.editReply("⚠️ Formato inválido. Usa DD/MM/YY");

      if (!db.examenes[fecha]) db.examenes[fecha] = [];
      if (!db.examenes[fecha].includes(materia)) {
        db.examenes[fecha].push(materia);
        saveDB(db);
        return interaction.editReply(`📚 Examen de **${materia}** agregado para ${fecha}`);
      } else {
        return interaction.editReply(`⚠️ El examen de **${materia}** ya está registrado en ${fecha}`);
      }
    }

    if (name === "removerhorario") {
      const fecha = interaction.options.getString("fecha");
      if (!/^\d{2}\/\d{2}\/\d{2}$/.test(fecha))
        return interaction.editReply("⚠️ Formato inválido. Usa DD/MM/YY");

      if (db.mensajesPersonalizados[fecha]) {
        delete db.mensajesPersonalizados[fecha];
        saveDB(db);
        return interaction.editReply(`🗑️ Mensaje personalizado eliminado para ${fecha}`);
      } else {
        return interaction.editReply(`⚠️ No hay mensaje personalizado para ${fecha}`);
      }
    }

    if (name === "removerexamen") {
      const fecha = interaction.options.getString("fecha");
      const materia = interaction.options.getString("materia");
      if (!/^\d{2}\/\d{2}\/\d{2}$/.test(fecha))
        return interaction.editReply("⚠️ Formato inválido. Usa DD/MM/YY");

      if (!db.examenes[fecha] || db.examenes[fecha].length === 0)
        return interaction.editReply(`⚠️ No hay exámenes registrados para ${fecha}`);

      const idx = db.examenes[fecha].indexOf(materia);
      if (idx > -1) {
        db.examenes[fecha].splice(idx, 1);
        if (db.examenes[fecha].length === 0) delete db.examenes[fecha];
        saveDB(db);
        return interaction.editReply(`🗑️ Examen de **${materia}** removido para ${fecha}`);
      } else {
        return interaction.editReply(`⚠️ No encontré la materia **${materia}** en ${fecha}`);
      }
    }

    if (name === "setcanal") {
      const canal = interaction.options.getChannel("canal");
      if (!canal) return interaction.editReply("⚠️ Canal inválido.");
      db.canalId = String(canal.id);
      saveDB(db);
      return interaction.editReply(`✅ Canal configurado: <#${canal.id}>`);
    }
  } catch (err) {
    console.error("❌ Error en interactionCreate:", err);
    await interaction.editReply("❌ Error interno al ejecutar el comando.");
  }
});

// ----- Ready & scheduling -----
client.once("clientReady", () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);

  // Programar envío diario a las 5:00 AM hora Venezuela
  schedule.scheduleJob({ hour: 5, minute: 0, tz: "America/Caracas" }, async () => {
    console.log("⏰ Trigger: envío diario (5:00 AM America/Caracas)");
    await enviarMensajeDiario();
  });

  console.log("🕔 Mensaje programado todos los días a las 5:00 AM (America/Caracas)");
});

// ----- Login -----
client.login(TOKEN);
