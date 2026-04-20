const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())
app.use(express.static('public'))

// 🔥 CONEXIÓN
mongoose.connect('mongodb+srv://admin:120916@cluster0.uztomh4.mongodb.net/escuela')
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.log(err))

// =====================
// 📦 MODELOS
// =====================

const Usuario = mongoose.model('Usuario', {
    nombre: String,
    usuario: String,
    password: String,
    rol: String,
    alumnoId: mongoose.Schema.Types.ObjectId
})

const Materia = mongoose.model('Materia', {
    nombre: String,
    maestroId: mongoose.Schema.Types.ObjectId
})

const Alumno = mongoose.model('Alumno', {
    nombre: String,
    edad: String,
    materias: [mongoose.Schema.Types.ObjectId]
})

const Calificacion = mongoose.model('Calificacion', {
    alumnoId: mongoose.Schema.Types.ObjectId,
    materiaId: mongoose.Schema.Types.ObjectId,
    calificacion: Number
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
    const { nombre, usuario, password, rol, alumnoId } = req.body

    const hash = await bcrypt.hash(password, 10)

    const nuevo = new Usuario({
        nombre,
        usuario,
        password: hash,
        rol,
        alumnoId
    })

    await nuevo.save()

    res.json({ mensaje: 'Usuario creado' })
})

app.post('/login', async (req, res) => {
    const { usuario, password } = req.body

    const user = await Usuario.findOne({ usuario })

    if (!user) return res.status(401).json({ mensaje: 'Usuario no existe' })

    const valido = await bcrypt.compare(password, user.password)

    if (!valido) return res.status(401).json({ mensaje: 'Contraseña incorrecta' })

    const token = jwt.sign({
        id: user._id, // 🔥 IMPORTANTE
        usuario: user.usuario,
        rol: user.rol,
        alumnoId: user.alumnoId
    }, 'secreto123')

    res.json({ token })
})

// =====================
// 👨‍🎓 ALUMNOS
// =====================

app.post('/alumnos', verificarToken, async (req, res) => {
    const nuevo = new Alumno(req.body)
    await nuevo.save()
    res.json(nuevo)
})

app.get('/alumnos', verificarToken, async (req, res) => {
    const alumnos = await Alumno.find()
    res.json(alumnos)
})

// =====================
// 👥 USUARIOS
// =====================

app.get('/usuarios', verificarToken, async (req, res) => {
    const usuarios = await Usuario.find()
    res.json(usuarios)
})

// =====================
// 📚 MATERIAS
// =====================

app.post('/materias', verificarToken, async (req, res) => {
    const nueva = new Materia({
        nombre: req.body.nombre,
        maestroId: req.body.maestroId
    })

    await nueva.save()
    res.json(nueva)
})

app.get('/materias', verificarToken, async (req, res) => {
    const materias = await Materia.find()
    res.json(materias)
})

// =====================
// 👨‍🏫 MAESTRO
// =====================

// materias del maestro
app.get('/mis-materias', verificarToken, async (req, res) => {
    const materias = await Materia.find({ maestroId: req.usuario.id })
    res.json(materias)
})

// alumnos del maestro
app.get('/mis-alumnos', verificarToken, async (req, res) => {

    const materias = await Materia.find({ maestroId: req.usuario.id })

    const ids = materias.map(m => m._id)

    const alumnos = await Alumno.find({
        materias: { $in: ids }
    })

    res.json(alumnos)
})

// =====================
// 📝 CALIFICACIONES
// =====================

app.post('/calificaciones', verificarToken, async (req, res) => {
    const nueva = new Calificacion(req.body)
    await nueva.save()
    res.json(nueva)
})

// alumno ve sus calificaciones
app.get('/mis-calificaciones', verificarToken, async (req, res) => {

    const califs = await Calificacion.find({
        alumnoId: req.usuario.alumnoId
    })

    const materias = await Materia.find()

    const resultado = califs.map(c => {
        const materia = materias.find(m => m._id.toString() === c.materiaId.toString())
        return {
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

    const alumno = await Alumno.findById(req.usuario.alumnoId)

    const materias = await Materia.find({
        _id: { $in: alumno.materias }
    })

    res.json({
        ...alumno.toObject(),
        materias
    })
})

// =====================
// 🚀 SERVER
// =====================

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Servidor corriendo 🔥')
})