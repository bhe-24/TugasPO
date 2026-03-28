// api/evaluasi.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode tidak diizinkan' });
    }

    const { instruction, reference, answer } = req.body;

    const promptText = `Anda adalah Sistem Evaluator Ahli untuk Cendekia Aksara.
    
KONTEKS:
Instruksi Tugas: "${instruction}"
Poin Referensi/Kunci: "${reference}"
Jawaban Siswa: "${answer}"

ATURAN PENILAIAN (PENTING):
1. Nilai substansi, gagasan, dan pemahaman siswa terhadap instruksi. Jangan terpaku pada kesamaan kata persis (hargai sinonim, gaya bahasa, dan kreativitas).
2. Berikan nilai "score" berupa angka bulat dari 0 hingga 100.
3. Berikan "feedback" (pesan evaluasi) maksimal 3 kalimat. Gunakan bahasa Indonesia yang ramah, memotivasi, dan jelaskan kekuatan/kekurangan jawaban tersebut.
4. DILARANG KERAS menggunakan kata "AI", "Kecerdasan Buatan", atau sejenisnya. Anda adalah "Sistem".

ATURAN OUTPUT HARGA MATI (STRICT JSON):
Anda HANYA diizinkan mengembalikan format JSON murni yang valid.
DILARANG menggunakan markdown (seperti \`\`\`json).
DILARANG menambahkan teks pembuka atau penutup.
Struktur JSON harus persis seperti contoh berikut:
{
  "score": 85,
  "feedback": "Jawabanmu sangat baik dan gagasan tersampaikan dengan jelas. Sistem mencatat kamu sudah memahami inti materi dengan tepat."
}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let textResponse = "";

    try {
        // --- COBA GEMINI ---
        if (geminiKey) {
            console.log("Mencoba menggunakan Gemini...");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                textResponse = data.candidates[0].content.parts[0].text;
                console.log("Gemini berhasil merespons!");
            } else {
                // INI PELACAKNYA: Akan mencetak alasan error dari Google ke Vercel Logs
                const errorData = await response.text();
                console.error("ALASAN GEMINI GAGAL:", errorData);
            }
        }

        // --- COBA GROQ JIKA GEMINI GAGAL ---
        if (!textResponse && groqKey) {
            console.log("Mencoba menggunakan Groq...");
            const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${groqKey}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    model: "llama3-8b-8192", 
                    messages: [{ role: "user", content: promptText }],
                    temperature: 0.1
                })
            });

            if (response.ok) {
                const data = await response.json();
                textResponse = data.choices[0].message.content;
                console.log("Groq berhasil merespons!");
            } else {
                // INI PELACAKNYA: Akan mencetak alasan error dari Groq
                const errorData = await response.text();
                console.error("ALASAN GROQ GAGAL:", errorData);
            }
        }

        if (!textResponse) {
            throw new Error("Semua kunci API Sistem gagal atau tidak dikonfigurasi di Vercel.");
        }

        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        if (typeof result.score !== 'number' || !result.feedback) {
            throw new Error("Sistem memberikan format yang tidak valid.");
        }

        res.status(200).json(result);

    } catch (error) {
        console.error("Kesalahan Evaluasi Sistem:", error);
        res.status(500).json({ 
            error: true, 
            score: 0, 
            feedback: "Sistem sedang sibuk atau mengalami kendala jaringan. Silakan coba kirim ulang jawabanmu beberapa saat lagi, ya." 
        });
    }
}
