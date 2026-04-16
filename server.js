const express = require('express')
const app = express()

app.use(express.json())
app.use(express.static('public'))

let alumnos = []

// LOGIN (simple)
app.post('/login', (req, res) => {
    const { usuario, password } = req.body

    if (usuario === 'admin' && password === '1234') {
        res.json({ mensaje: 'Login correcto' })
    } else {
        res.status(401).json({ mensaje: 'Datos incorrectos' })
    }
})

// REGISTRAR ALUMNO
app.post('/alumnos', (req, res) => {
    alumnos.push(req.body)
    res.json({ mensaje: 'Alumno guardado' })
})

// OBTENER ALUMNOS
app.get('/alumnos', (req, res) => {
    res.json(alumnos)
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Servidor corriendo')
})