const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ====================================================
// KONEKSI DATABASE ONLINE SUPABASE (POSTGRESQL)
// ====================================================
const connectionString = "postgresql://postgres:Administrasi6101@db.eimdfqhkjfocelsqkxql.supabase.co:5432/postgres";

const pool = new Pool({
    connectionString: connectionString,
});

// Fungsi untuk membuat tabel otomatis jika belum ada di database cloud
async function inisialisasiDatabase() {
    try {
        // 1. Buat Tabel Users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                nama_lengkap TEXT,
                role TEXT
            );
        `);

        // 2. Buat Tabel Paket
        await pool.query(`
            CREATE TABLE IF NOT EXISTS paket (
                id SERIAL PRIMARY KEY,
                stambuk TEXT,
                nama TEXT,
                kelas TEXT,
                rayon TEXT,
                daerah TEXT,
                orangtua TEXT,
                jumlah TEXT,
                jenis_paket TEXT,
                tempat TEXT,
                status TEXT,
                petugas_input TEXT,
                waktu_masuk TEXT,
                waktu_keluar TEXT,
                petugas_keluar TEXT
            );
        `);

        // 3. Buat Akun Super Admin Otomatis jika kosong
        const resAdmin = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        if (resAdmin.rows.length === 0) {
            await pool.query("INSERT INTO users (username, password, nama_lengkap, role) VALUES ($1, $2, $3, $4)", 
                ['admin', 'superadmin123', 'admin', 'superadmin']);
            console.log("🔑 Akun Super Admin Berhasil Diinisialisasi");
        }

        console.log("💾 Database Cloud Supabase Sukses Terkoneksi ONLINE & Siap!");
    } catch (err) {
        console.error("❌ Gagal Inisialisasi Tabel Supabase:", err);
    }
}
inisialisasiDatabase();

// --- API: CARI DATA DARI EXCEL DATA BASE SANTRI ---
app.get('/api/mahasiswa/:stambuk', (req, res) => {
    const targetStambuk = req.params.stambuk.trim();
    const excelPath = path.join(__dirname, 'data_base_santri.xlsx');
    if (!fs.existsSync(excelPath)) {
        return res.status(404).json({ success: false, message: "File data_base_santri.xlsx tidak ditemukan!" });
    }
    try {
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const santri = sheetData.find(row => String(row.stambuk).trim() === targetStambuk);
        if (santri) {
            res.json({
                success: true,
                data: {
                    nama: santri.nama || '-',
                    kelas: santri.kelas || '-',
                    rayon: santri.rayon || '-',
                    daerah: santri.daerah || '-',
                    orangtua: santri.orangtua || santri.orang_tua || '-'
                }
            });
        } else {
            res.status(404).json({ success: false, message: "Nomor Stambuk tidak terdaftar di Excel Santri!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Gagal membaca file Excel!" });
    }
});

// --- API LOGIN ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'superadmin123') {
        return res.json({ success: true, user: { username: 'admin', nama: 'admin', role: 'superadmin' } });
    }
    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = result.rows[0];
        if (user && String(user.password) === String(password)) {
            return res.json({ success: true, user: { username: user.username, nama: user.nama_lengkap, role: user.role } });
        } else {
            return res.status(401).json({ success: false, message: "Username/Password salah!" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error Server" });
    }
});

// --- API USER (KELOLA AKUN PETUGAS) ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE username != 'admin'");
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Gagal mengambil data user" }); }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        await pool.query("INSERT INTO users (username, password, nama_lengkap, role) VALUES ($1, $2, $3, $4)", 
            [username, password, username, role]);
        res.json({ success: true, message: "Akun berhasil disimpan!" });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/users/ganti-password', async (req, res) => {
    const { username, passwordBaru } = req.body;
    try {
        await pool.query("UPDATE users SET password = $1 WHERE username = $2", [passwordBaru, username]);
        res.json({ success: true, message: "Password diperbarui!" });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM users WHERE username = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

// --- API PAKET ---
app.get('/api/paket', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM paket ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Gagal mengambil data paket" }); }
});

app.post('/api/paket', async (req, res) => {
    const p = req.body;
    try {
        await pool.query(`
            INSERT INTO paket (stambuk, nama, kelas, rayon, daerah, orangtua, jumlah, jenis_paket, tempat, status, petugas_input, waktu_masuk, waktu_keluar, petugas_keluar)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [p.stambuk, p.nama, p.kelas, p.rayon, p.daerah, p.orangtua, p.jumlah, p.jenis_paket, p.tempat, p.status, p.petugas_input, p.waktu_masuk, p.waktu_keluar, p.petugas_keluar]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Gagal menyimpan paket" }); }
});

app.put('/api/paket/:id', async (req, res) => {
    const id = req.params.id;
    const { status, waktu_keluar, tempat, petugas_keluar } = req.body;
    try {
        if (tempat !== undefined) {
            await pool.query("UPDATE paket SET tempat = $1 WHERE id = $2", [tempat, id]);
        }
        if (status !== undefined) {
            await pool.query("UPDATE paket SET status = $1, waktu_keluar = $2, petugas_keluar = $3 WHERE id = $4", 
                [status, waktu_keluar, petugas_keluar || '-', id]);
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Gagal memperbarui data paket" }); }
});

app.delete('/api/paket/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM paket WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

// Port dinamis agar kompatibel dengan Cloud Hosting
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Server berjalan di port ${PORT}`); });