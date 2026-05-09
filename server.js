const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { Resend } = require('resend')

const resend = new Resend(
    're_QaZ1bsbN_NjSgvXZQuzCJHx22Utj1LZb3'
)
const http = require('http')
const { Server } = require('socket.io')


const app = express()

app.use(express.json())
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'))

// 🔥 CONEXIÓN
mongoose.connect('mongodb+srv://admin:120916@cluster0.uztomh4.mongodb.net/escuela')
    .then(() => console.log('Mongo conectado 🔥'))
    .catch(err => console.log(err))


// =====================
// 📦 MODELOS
// =====================

const Tarea = mongoose.model('Tarea', {
    titulo: String,
    descripcion: String,
    materiaId: mongoose.Schema.Types.ObjectId,
    grupo: String,
    fechaLimite: String, // YYYY-MM-DD
    horaLimite: String   // HH:mm
})

const Entrega = mongoose.model('Entrega', {
    tareaId: mongoose.Schema.Types.ObjectId,
    alumnoId: mongoose.Schema.Types.ObjectId,
    archivo: String,
    fechaEntrega: Date,
    calificacion: Number,
    comentario: String
})

const Usuario = mongoose.model('Usuario', {
    nombre: String,
    email: String,
    usuario: String,
    password: String,
    rol: String,
    alumnoId: mongoose.Schema.Types.ObjectId,
    alumnos: [mongoose.Schema.Types.ObjectId]
})

const Carrera = mongoose.model('Carrera', {
    nombre: String
})

const Materia = mongoose.model('Materia', {
    nombre: String,
    maestroId: mongoose.Schema.Types.ObjectId,
    carreraId: mongoose.Schema.Types.ObjectId
})

const Grupo = mongoose.model('Grupo', {

    nombre: String,

    materiaId:
        mongoose.Schema.Types.ObjectId,

    maestroId:
        mongoose.Schema.Types.ObjectId
})

const Alumno = mongoose.model('Alumno', {
    nombre: String,
    edad: String,
    carreraId: mongoose.Schema.Types.ObjectId,
    grupos: [mongoose.Schema.Types.ObjectId],
    materias: [mongoose.Schema.Types.ObjectId]
})

const Calificacion = mongoose.model('Calificacion', {
    alumnoId: mongoose.Schema.Types.ObjectId,
    materiaId: mongoose.Schema.Types.ObjectId,
    calificacion: Number
})

const Mensaje = mongoose.model('Mensaje', {
    de: String,
    para: String,
    mensaje: String,
    nombre: String,
    fecha: {
        type: Date,
        default: Date.now
    }
})

const CodigoReset = mongoose.model('CodigoReset', {

    email: String,

    codigo: String,

    expira: Date
})


// =====================
// 🔐 MIDDLEWARE
// =====================

function verificarToken(req, res, next) {
    const token = req.headers['authorization']
    if (!token) return res.status(403).json({ mensaje: 'No autorizado' })

    try {
        const decoded = jwt.verify(token, 'secreto123')
        req.usuario = decoded
        next()
    } catch {
        res.status(401).json({ mensaje: 'Token inválido' })
    }
}

function soloAdmin(req, res, next) {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Solo admin' })
    }
    next()
}

// =====================
// 🔐 LOGIN / REGISTRO
// =====================

app.post('/registro', verificarToken, soloAdmin, async (req, res) => {
    const { nombre, email, usuario, password, rol, alumnoId, alumnos } = req.body

    const hash = await bcrypt.hash(password, 10)

    const nuevo = new Usuario({
        nombre,
        email,
        usuario,
        password: hash,
        rol,

        // 🔥 SI ES ALUMNO
        alumnoId: rol === 'alumno' ? alumnoId : null,

        // 🔥 SI ES PADRE
        alumnos: rol === 'padre' ? (alumnos || []) : []
    })

    await nuevo.save()
    res.json({ mensaje: 'Usuario creado 🔥' })
})

app.post('/login', async (req, res) => {
    const { usuario, password } = req.body

    const user = await Usuario.findOne({ usuario })
    if (!user) return res.status(401).json({ mensaje: 'Usuario no existe' })

    const valido = await bcrypt.compare(password, user.password)
    if (!valido) return res.status(401).json({ mensaje: 'Contraseña incorrecta' })

    const token = jwt.sign({
    id: user._id,
    usuario: user.usuario,
    rol: user.rol,
    alumnoId: user.alumnoId,
    alumnos: user.alumnos || [] // 🔥 CLAVE
}, 'secreto123')

    res.json({ token })
})

// =====================
// 🎓 CARRERAS
// =====================

app.post('/carreras', verificarToken, async (req, res) => {
    const nueva = new Carrera({ nombre: req.body.nombre })
    await nueva.save()
    res.json(nueva)
})

app.get('/carreras', verificarToken, async (req, res) => {
    res.json(await Carrera.find())
})

// =====================
// 📚 MATERIAS
// =====================

app.post('/materias', verificarToken, async (req, res) => {
    const nueva = new Materia({
        nombre: req.body.nombre,
        maestroId: req.body.maestroId,
        carreraId: req.body.carreraId
    })

    await nueva.save()
    res.json(nueva)
})

app.get('/materias', verificarToken, async (req, res) => {

    const materias = await Materia.find()

    const usuarios = await Usuario.find()

    const resultado = materias.map(m => {

        const maestro = usuarios.find(u =>
            u._id.toString() ===
            m.maestroId?.toString()
        )

        return {

            ...m.toObject(),

            maestroNombre:
                maestro?.nombre || 'Sin maestro'
        }
    })

    res.json(resultado)
})

app.get('/materias-por-carrera/:id', verificarToken, async (req, res) => {
    const materias = await Materia.find({ carreraId: req.params.id })
    res.json(materias)
})

// =====================
// 👨‍🎓 ALUMNOS
// =====================

app.post('/alumnos', verificarToken, async (req, res) => {

    const materias = (req.body.materias || []).map(id => new mongoose.Types.ObjectId(id))

    const nuevo = new Alumno({
        nombre: req.body.nombre,
        edad: req.body.edad,
        carreraId: req.body.carreraId,
        grupo: req.body.grupos || [], // 🔥 AQUÍ
        materias
    })

    await nuevo.save()
    res.json(nuevo)
})

app.get('/alumnos', verificarToken, async (req, res) => {
    res.json(await Alumno.find())
})

app.put('/alumnos/:id/materias', verificarToken, async (req, res) => {

    const alumnoId = req.params.id
    const nuevasMaterias = req.body.materias

    await Alumno.findByIdAndUpdate(alumnoId, {
        $addToSet: { materias: { $each: nuevasMaterias } }
    })

    res.json({ mensaje: 'Materias agregadas 🔥' })
})

// =====================
// 👨‍🏫 MAESTRO
// =====================

app.get('/mis-materias', verificarToken, async (req, res) => {
    const materias = await Materia.find({ maestroId: req.usuario.id })
    res.json(materias)
})

app.get('/mis-alumnos', verificarToken, async (req, res) => {

    const materias = await Materia.find({

        maestroId: req.usuario.id
    })

    const alumnos = await Alumno.find({

        materias: {
            $in: materias.map(m => m._id)
        }
    })

    let resultado = []

    alumnos.forEach(alumno => {

        materias.forEach(materia => {

            const tieneMateria =
                alumno.materias.some(m =>
                    m.toString() ===
                    materia._id.toString()
                )

            if(tieneMateria){

                resultado.push({

                    _id: alumno._id,

                    nombre: alumno.nombre,

                    materiaId:
                        materia._id,

                    materiaNombre:
                        materia.nombre
                })
            }
        })
    })

    res.json(resultado)
})

app.post('/tareas', verificarToken, async (req, res) => {

    const { titulo, descripcion, materiaId, grupo, fechaLimite, horaLimite } = req.body

    if (!titulo || !materiaId || !grupo) {
        return res.status(400).json({ mensaje: 'Datos incompletos' })
    }

    const nueva = new Tarea({
        titulo,
        descripcion,
        materiaId,
        grupo,
        fechaLimite,
        horaLimite
    })

    await nueva.save()

    res.json(nueva)
})

app.get('/tareas', verificarToken, async (req, res) => {

    // si es maestro → solo sus materias
    if (req.usuario.rol === 'maestro') {
        const materias = await Materia.find({ maestroId: req.usuario.id })

        const tareas = await Tarea.find({
            materiaId: { $in: materias.map(m => m._id) }
        })

        return res.json(tareas)
    }

    // admin → todas
    res.json(await Tarea.find())
})

app.get('/mis-tareas', verificarToken, async (req, res) => {

    if (!req.usuario.alumnoId) return res.json([])

    const alumno = await Alumno.findById(req.usuario.alumnoId)

    if (!alumno) return res.json([])

    const tareas = await Tarea.find({
        grupo: alumno.grupo,
        materiaId: { $in: alumno.materias }
    })

    res.json(tareas)
})

// =====================
// 📝 CALIFICACIONES
// =====================

app.post('/calificaciones', verificarToken, async (req, res) => {

    const { alumnoId, materiaId, calificacion } = req.body

    if (calificacion < 0 || calificacion > 10) {
        return res.status(400).json({ mensaje: 'Calificación inválida' })
    }

    const existe = await Calificacion.findOne({
        alumnoId,
        materiaId
    })

    if (existe) {
        return res.status(400).json({ mensaje: 'Ya está calificado' })
    }

    const nueva = new Calificacion({
        alumnoId,
        materiaId,
        calificacion
    })

    await nueva.save()

    res.json(nueva)
})

app.get('/calificaciones', verificarToken, async (req, res) => {
    const califs = await Calificacion.find()
    res.json(califs)
})

app.get('/mis-calificaciones', verificarToken, async (req, res) => {

    let filtro = {}

    if (req.usuario.rol === 'alumno') {
        filtro = { alumnoId: req.usuario.alumnoId }
    }

    if (req.usuario.rol === 'padre') {
        filtro = { alumnoId: { $in: req.usuario.alumnos } }
    }

    const califs = await Calificacion.find(filtro)
    const materias = await Materia.find()

    const resultado = califs.map(c => {
        const materia = materias.find(m => m._id.toString() === c.materiaId.toString())
        return {
    alumnoId: c.alumnoId.toString(),
    materiaId: c.materiaId.toString(), // 🔥 AGREGA ESTO
    materia: materia?.nombre,
    calificacion: c.calificacion
}
    })

    res.json(resultado)
})

// =====================
// 🎓 DASHBOARD ALUMNO
// =====================

app.get('/mi-alumno', verificarToken, async (req, res) => {

    if (!req.usuario.alumnoId) {
        return res.status(400).json({ mensaje: 'No tiene alumno asignado' })
    }

    const alumno = await Alumno.findById(req.usuario.alumnoId)

    if (!alumno) {
        return res.status(404).json({ mensaje: 'Alumno eliminado o inválido' })
    }

    const materias = await Materia.find({
        _id: { $in: alumno.materias }
    })

    res.json({
        ...alumno.toObject(),
        materias
    })
})

app.get('/usuarios', verificarToken, async (req, res) => {
    const usuarios = await Usuario.find().select(
        '_id nombre rol'
    )
    res.json(usuarios)
})

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

app.get('/alertas', verificarToken, async (req, res) => {

    if (req.usuario.rol !== 'padre') {
        return res.status(403).json({ mensaje: 'Solo padres' })
    }

    const hijos = req.usuario.alumnos

    const alumnos = await Alumno.find({
        _id: { $in: hijos }
    })

    const materias = await Materia.find()
    const calificaciones = await Calificacion.find({
        alumnoId: { $in: hijos }
    })

    let alertas = []

    alumnos.forEach(alumno => {

        alumno.materias.forEach(materiaId => {

            const calif = calificaciones.find(c =>
                c.alumnoId.toString() === alumno._id.toString() &&
                c.materiaId.toString() === materiaId.toString()
            )

            const materia = materias.find(m =>
                m._id.toString() === materiaId.toString()
            )

            // ❌ SIN CALIFICACIÓN
            if (!calif) {
            alertas.push({
            id: alumno._id.toString() + '-' + materiaId.toString(), // 🔥 AQUÍ
            tipo: 'pendiente',
            mensaje: `${alumno.nombre} no tiene calificación en ${materia?.nombre}`
    })
}

            // ⚠️ BAJA CALIFICACIÓN
            if (calif && calif.calificacion < 7) {
                alertas.push({
                    tipo: 'baja',
                    mensaje: `${alumno.nombre} tiene ${calif.calificacion} en ${materia?.nombre}`
                })
            }

        })

    })

    // =====================
// 📝 ALERTAS DE TAREAS
// =====================

const tareas = await Tarea.find()
const entregas = await Entrega.find({
    alumnoId: { $in: hijos }
})

for (let alumno of alumnos) {

    // 🔥 TAREAS DEL GRUPO
    const tareasAlumno = tareas.filter(t =>
        t.grupo === alumno.grupo &&
        alumno.materias.some(m =>
            m.toString() === t.materiaId.toString()
        )
    )

    for (let tarea of tareasAlumno) {

        const entrega = entregas.find(e =>
            e.tareaId.toString() === tarea._id.toString() &&
            e.alumnoId.toString() === alumno._id.toString()
        )

        // ❌ NO ENTREGÓ
        if (!entrega) {

            alertas.push({
                tipo: 'tarea-pendiente',
                mensaje:
                `${alumno.nombre} no ha entregado la tarea "${tarea.titulo}"`
            })
        }

        // ✅ ENTREGÓ
        if (entrega) {

            alertas.push({
                tipo: 'tarea-entregada',
                mensaje:
                `${alumno.nombre} entregó "${tarea.titulo}"`
            })

            // 🔥 YA CALIFICADA
            if (
                entrega.calificacion !== undefined &&
                entrega.calificacion !== null
            ) {

                alertas.push({
                    tipo: 'tarea-calificada',
                    mensaje:
                    `${alumno.nombre} obtuvo ${entrega.calificacion} en "${tarea.titulo}"`
                })

                // ⚠️ BAJA
                if (entrega.calificacion < 7) {

                    alertas.push({
                        tipo: 'tarea-baja',
                        mensaje:
                        `${alumno.nombre} sacó baja calificación en "${tarea.titulo}"`
                    })
                }
            }
        }

    }
}

    res.json(alertas)
})

app.get('/entregas/:tareaId', verificarToken, async (req, res) => {

    const entregas = await Entrega.find({
        tareaId: req.params.tareaId
    })

    const alumnos = await Alumno.find()

    const resultado = entregas.map(e => {

        const alumno = alumnos.find(a =>
            a._id.toString() === e.alumnoId.toString()
        )

        return {
    _id: e._id,
    alumno: alumno?.nombre || 'Alumno',
    archivo: e.archivo,
    fechaEntrega: e.fechaEntrega,

    calificacion: e.calificacion,
    comentario: e.comentario
}
    })

    res.json(resultado)
})

app.put('/calificar-tarea/:id', verificarToken, async (req, res) => {

    const { calificacion, comentario } = req.body

    const entrega = await Entrega.findById(req.params.id)

    if (!entrega) {
        return res.status(404).json({
            mensaje: 'Entrega no encontrada'
        })
    }

    // 🔒 YA CALIFICADA
    if (
        entrega.calificacion !== undefined &&
        entrega.calificacion !== null
    ) {
        return res.status(400).json({
            mensaje: 'Esta tarea ya fue calificada 🔒'
        })
    }

    entrega.calificacion = calificacion
    entrega.comentario = comentario

    await entrega.save()

    res.json({
        mensaje: 'Tarea calificada 🔥'
    })
})

const multer = require('multer')

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const upload = multer({ storage })

app.post('/entregar-tarea', verificarToken, upload.single('archivo'), async (req, res) => {

    const { tareaId } = req.body

    const tarea = await Tarea.findById(tareaId)

    if (!tarea) return res.status(404).json({ mensaje: 'Tarea no existe' })

    // 🔥 VALIDACIÓN DE TIEMPO
    const ahora = new Date()

    const limite = new Date(`${tarea.fechaLimite}T${tarea.horaLimite}`)

    if (ahora > limite) {
        return res.status(400).json({ mensaje: 'Tiempo agotado ⛔' })
    }

    const existe = await Entrega.findOne({
        tareaId,
        alumnoId: req.usuario.alumnoId
    })

    if (existe) {
        return res.status(400).json({ mensaje: 'Ya entregaste esta tarea' })
    }

    const nueva = new Entrega({
        tareaId,
        alumnoId: req.usuario.alumnoId,
        archivo: req.file.filename,
        fechaEntrega: new Date()
    })

    await nueva.save()

    res.json({ mensaje: 'Tarea enviada 🔥' })
})

app.get('/mis-entregas', verificarToken, async (req, res) => {

    const entregas = await Entrega.find({
        alumnoId: req.usuario.alumnoId
    })

    const tareas = await Tarea.find()

    const resultado = entregas.map(e => {

        const tarea = tareas.find(t =>
            t._id.toString() === e.tareaId.toString()
        )

        return {
            tarea: tarea?.titulo,
            calificacion: e.calificacion,
            comentario: e.comentario
        }
    })

    res.json(resultado)
})

app.get('/mensajes/:usuario', verificarToken, async (req, res) => {

    const miId = req.usuario.id
    const otro = req.params.usuario

    const mensajes = await Mensaje.find({
        $or: [
            { de: miId, para: otro },
            { de: otro, para: miId }
        ]
    }).sort({ fecha: 1 })

    res.json(mensajes)
})

// =====================
// 🔐 RECUPERAR PASSWORD
// =====================

app.post('/olvide-password', async (req, res) => {

    try {

        const { email } = req.body

        console.log('EMAIL:', email)

        const usuario =
            await Usuario.findOne({ email })

        if (!usuario) {

            return res.status(404).json({
                mensaje: 'Correo no encontrado'
            })
        }

        const codigo =
            Math.floor(
                100000 + Math.random() * 900000
            ).toString()

        await CodigoReset.deleteMany({ email })

        await CodigoReset.create({

            email,

            codigo,

            expira:
                new Date(Date.now() + 10 * 60000)
        })

        console.log('Código generado:', codigo)

        const enviado = await resend.emails.send({

    from: 'CEPM <onboarding@resend.dev>',

    to: 'cepmsoporte@gmail.com',

    subject: 'Recuperar contraseña',

    html: `
        <h1>
            Código:
            ${codigo}
        </h1>
    `
})

console.log(enviado)

        console.log('Correo enviado 🔥')

        res.json({
            mensaje: 'Código enviado 🔥'
        })

    } catch(err) {

        console.log('ERROR RESET:')
        console.log(err)

        res.status(500).json({
            mensaje: 'Error servidor 😭'
        })
    }
})

app.post('/grupos', verificarToken, async (req, res) => {

    const nuevo = new Grupo({

        nombre:
            req.body.nombre,

        materiaId:
            req.body.materiaId,

        maestroId:
            req.body.maestroId
    })

    await nuevo.save()

    res.json(nuevo)
})

app.get('/grupos', verificarToken, async (req, res) => {

    const grupos =
        await Grupo.find()

    res.json(grupos)
})

app.post('/cambiar-password-directo', async (req, res) => {

    const {
        email,
        nuevaPassword
    } = req.body

    const hash =
        await bcrypt.hash(
            nuevaPassword,
            10
        )

    await Usuario.updateOne(

        { email },

        {
            password: hash
        }
    )

    res.json({
        mensaje:'Contraseña actualizada 🔥'
    })
})

app.post('/reset-password', async (req, res) => {

    const {
        email,
        codigo,
        nuevaPassword
    } = req.body

    const existe =
        await CodigoReset.findOne({
            email,
            codigo
        })

    if (!existe) {

        return res.status(400).json({
            mensaje: 'Código inválido'
        })
    }

    if (new Date() > existe.expira) {

        return res.status(400).json({
            mensaje: 'Código expirado'
        })
    }

    const hash =
        await bcrypt.hash(nuevaPassword, 10)

    await Usuario.updateOne(
        { email },
        {
            password: hash
        }
    )

    await CodigoReset.deleteMany({ email })

    res.json({
        mensaje: 'Contraseña actualizada 🔥'
    })
})



// =====================
// 🚀 SERVER
// =====================

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "*"
    }
})

io.on('connection', (socket) => {

    console.log('Usuario conectado 🔥')

    socket.on('entrar', (usuarioId) => {
        socket.join(usuarioId)
    })

    socket.on('mensaje', async (data) => {

        const usuario = await Usuario.findById(data.de)

const nuevo = new Mensaje({
    de: data.de,
    para: data.para,
    mensaje: data.mensaje,
    nombre: usuario?.nombre || 'Usuario'
})

        await nuevo.save()

        io.to(data.para).emit('mensaje', nuevo)
        io.to(data.de).emit('mensaje', nuevo)
    })

})

server.listen(3000, () => {
    console.log('Servidor listo 🔥')
})