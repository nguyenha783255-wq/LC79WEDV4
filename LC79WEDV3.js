// ============================================================
// LC79.js – API siêu VIP phân tích Tài/Xỉu
// Tác giả: @DENIUS09
// Mô tả: AI SUPER GEMINI tự học, phân tích cầu, xúc xắc, xu hướng,
// sử dụng Markov, tần suất, phân phối điểm, và suy luận logic.
// ============================================================

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// LƯU TRỮ DỮ LIỆU TOÀN CỤC
// ============================================================
let sessionData = {
    list: [],
    typeStat: { TAI: 0, XIU: 0 },
    lastUpdate: null,
    history: [],
};

let prediction = {
    currentSessionId: null,
    predictedResult: 'TAI',
    predictedDices: [3, 3, 4],
    confidence: 50,
    analysis: '',
};

// ============================================================
// HÀM GỌI API GỐC VÀ CẬP NHẬT DỮ LIỆU
// ============================================================
async function fetchSessions() {
    try {
        const response = await axios.get('https://wtxmd52.tele68.com/v1/txmd5/sessions', {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = response.data;
        if (data && data.list && data.list.length > 0) {
            const sortedList = data.list.sort((a, b) => b.id - a.id);
            sessionData.list = sortedList;
            sessionData.typeStat = data.typeStat || { TAI: 0, XIU: 0 };
            sessionData.lastUpdate = new Date().toISOString();
            sessionData.history = sortedList.map(item => ({
                id: item.id,
                result: item.resultTruyenThong,
                dices: item.dices,
                point: item.point,
                _id: item._id,
            }));
            // Chạy phân tích dự đoán
            runAdvancedPrediction();
        }
    } catch (error) {
        console.error('Lỗi khi gọi API gốc:', error.message);
    }
}

// ============================================================
// LỚP AI SUPER GEMINI – PHÂN TÍCH ĐA CHIỀU, TỰ HỌC
// ============================================================
class SuperGemini {
    constructor() {
        this.history = [];
        this.memory = {
            lastResult: null,
            streak: 0,
            recentTai: 0,
            recentXiu: 0,
            patternCache: {},
            // Lưu điểm trung bình theo loại
            avgPoints: { TAI: 0, XIU: 0 },
            // Tần suất xuất hiện từng mặt xúc xắc
            diceFreq: [0, 0, 0, 0, 0, 0],
        };
        // Trọng số thuật toán
        this.weights = {
            markov: 0.25,
            frequency: 0.20,
            trend: 0.15,
            pattern: 0.15,
            break: 0.10,
            diceLogic: 0.10,
            random: 0.05,
        };
        this.learningRate = 0.02;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.lastPrediction = null;
    }

    // Cập nhật lịch sử và các thống kê
    updateHistory(history) {
        this.history = history;
        if (history.length === 0) return;

        // Cập nhật bộ nhớ
        const latest = history[0];
        this.memory.lastResult = latest.result;
        const recent = history.slice(0, 20);
        this.memory.recentTai = recent.filter(h => h.result === 'TAI').length;
        this.memory.recentXiu = recent.filter(h => h.result === 'XIU').length;

        let streak = 0;
        for (let i = 0; i < history.length; i++) {
            if (history[i].result === latest.result) streak++;
            else break;
        }
        this.memory.streak = streak;

        // Tính điểm trung bình cho TAI và XIU
        const taiList = history.filter(h => h.result === 'TAI');
        const xiuList = history.filter(h => h.result === 'XIU');
        this.memory.avgPoints.TAI = taiList.reduce((s, h) => s + h.point, 0) / (taiList.length || 1);
        this.memory.avgPoints.XIU = xiuList.reduce((s, h) => s + h.point, 0) / (xiuList.length || 1);

        // Tần suất các mặt xúc xắc (1-6)
        const freq = [0,0,0,0,0,0];
        history.forEach(h => {
            h.dices.forEach(d => { freq[d-1]++; });
        });
        this.memory.diceFreq = freq;

        this.buildPatternCache();
    }

    // Xây dựng cache Markov bậc 2
    buildPatternCache() {
        const cache = {};
        for (let i = 0; i < this.history.length - 2; i++) {
            const key = this.history[i].result + '|' + this.history[i+1].result;
            const next = this.history[i+2].result;
            if (!cache[key]) cache[key] = { TAI: 0, XIU: 0 };
            cache[key][next]++;
        }
        this.memory.patternCache = cache;
    }

    // Markov bậc 2
    markovPredict() {
        const h = this.history;
        if (h.length < 2) return { TAI: 0.5, XIU: 0.5 };
        const key = h[0].result + '|' + h[1].result;
        const stats = this.memory.patternCache[key];
        if (!stats) return { TAI: 0.5, XIU: 0.5 };
        const total = stats.TAI + stats.XIU;
        if (total === 0) return { TAI: 0.5, XIU: 0.5 };
        return { TAI: stats.TAI / total, XIU: stats.XIU / total };
    }

    // Tần suất tổng thể
    frequencyPredict() {
        const total = this.history.length;
        if (total === 0) return { TAI: 0.5, XIU: 0.5 };
        const tai = this.history.filter(h => h.result === 'TAI').length;
        return { TAI: tai / total, XIU: (total - tai) / total };
    }

    // Xu hướng gần đây (20 phiên)
    trendPredict() {
        const recent = this.history.slice(0, 20);
        if (recent.length === 0) return { TAI: 0.5, XIU: 0.5 };
        const tai = recent.filter(h => h.result === 'TAI').length;
        return { TAI: tai / recent.length, XIU: (recent.length - tai) / recent.length };
    }

    // Nhận dạng mẫu chuỗi 3 phiên
    patternPredict() {
        const h = this.history;
        if (h.length < 4) return { TAI: 0.5, XIU: 0.5 };
        const last3 = h.slice(0, 3).map(x => x.result);
        const pattern = last3.join('');
        let taiNext = 0, xiuNext = 0;
        for (let i = 0; i < h.length - 3; i++) {
            const p = h[i].result + h[i+1].result + h[i+2].result;
            if (p === pattern) {
                const next = h[i+3].result;
                if (next === 'TAI') taiNext++;
                else xiuNext++;
            }
        }
        const total = taiNext + xiuNext;
        if (total === 0) return { TAI: 0.5, XIU: 0.5 };
        return { TAI: taiNext / total, XIU: xiuNext / total };
    }

    // Phân tích bẻ cầu thông minh (dựa trên độ lệch chuẩn và biến động)
    breakPredict() {
        const streak = this.memory.streak;
        if (streak < 3) return { TAI: 0.5, XIU: 0.5 };

        // Xem xét sự biến động điểm số gần đây
        const recentPoints = this.history.slice(0, 10).map(h => h.point);
        const mean = recentPoints.reduce((a, b) => a + b, 0) / recentPoints.length;
        const variance = recentPoints.reduce((a, b) => a + (b - mean) ** 2, 0) / recentPoints.length;
        const std = Math.sqrt(variance);

        // Nếu điểm số biến động lớn, khả năng bẻ cầu cao
        const breakProb = Math.min(0.75, 0.25 + (streak - 2) * 0.06 + (std > 2 ? 0.1 : 0));
        const lastResult = this.memory.lastResult;
        if (lastResult === 'TAI') {
            return { TAI: 1 - breakProb, XIU: breakProb };
        } else {
            return { TAI: breakProb, XIU: 1 - breakProb };
        }
    }

    // Phân tích logic xúc xắc dựa trên điểm trung bình và tần suất mặt
    diceLogicPredict() {
        // Dựa trên điểm trung bình của từng loại, và xu hướng điểm gần đây
        const avgTai = this.memory.avgPoints.TAI;
        const avgXiu = this.memory.avgPoints.XIU;
        const recentAvg = this.history.slice(0, 10).reduce((s, h) => s + h.point, 0) / Math.min(10, this.history.length);

        // Nếu điểm trung bình gần đây cao hơn avgTai → xu hướng TAI, ngược lại XIU
        if (recentAvg > avgTai + 1) {
            return { TAI: 0.65, XIU: 0.35 };
        } else if (recentAvg < avgXiu - 1) {
            return { TAI: 0.35, XIU: 0.65 };
        } else {
            // Dùng tần suất mặt xuất hiện để dự đoán điểm số
            // Giả lập: mặt nào xuất hiện nhiều sẽ kéo điểm cao hơn
            const freq = this.memory.diceFreq;
            const maxFace = freq.indexOf(Math.max(...freq)) + 1; // 1-6
            // Nếu maxFace >= 4, khả năng điểm cao (Tài)
            if (maxFace >= 4) return { TAI: 0.6, XIU: 0.4 };
            else return { TAI: 0.4, XIU: 0.6 };
        }
    }

    // Tổng hợp dự đoán
    predict() {
        if (this.history.length === 0) {
            return { result: 'TAI', dices: [3, 3, 4], confidence: 50 };
        }

        const markov = this.markovPredict();
        const freq = this.frequencyPredict();
        const trend = this.trendPredict();
        const pattern = this.patternPredict();
        const breakPred = this.breakPredict();
        const diceLogic = this.diceLogicPredict();

        const w = this.weights;
        const taiProb = 
            markov.TAI * w.markov +
            freq.TAI * w.frequency +
            trend.TAI * w.trend +
            pattern.TAI * w.pattern +
            breakPred.TAI * w.break +
            diceLogic.TAI * w.diceLogic +
            0.5 * w.random;

        const result = taiProb >= 0.5 ? 'TAI' : 'XIU';
        const confidence = Math.round(Math.abs(taiProb - 0.5) * 2 * 100);
        const dices = this.predictDices(result);

        this.lastPrediction = { result, confidence, dices, taiProb };
        return { result, dices, confidence: Math.min(confidence, 99) };
    }

    // Dự đoán xúc xắc dựa trên phân phối điểm và tần suất mặt
    predictDices(result) {
        const recent = this.history.slice(0, 50);
        const sameResult = recent.filter(h => h.result === result);
        if (sameResult.length === 0) return [3, 3, 4];

        // Ước lượng tổng điểm dựa trên trung bình và xu hướng gần đây
        const avgPoint = sameResult.reduce((s, h) => s + h.point, 0) / sameResult.length;
        const recentPoints = recent.slice(0, 10).map(h => h.point);
        const recentAvg = recentPoints.reduce((s, p) => s + p, 0) / recentPoints.length;
        let targetSum = Math.round(0.6 * avgPoint + 0.4 * recentAvg);
        targetSum = Math.max(3, Math.min(18, targetSum));

        // Tạo bộ xúc xắc có tổng gần targetSum và phân bố mặt dựa trên tần suất
        let dices = this.generateDicesBySumWithFreq(targetSum, this.memory.diceFreq);
        return dices;
    }

    generateDicesBySumWithFreq(sum, freq) {
        // Tạo bộ xúc xắc dựa trên tần suất và tổng mục tiêu
        for (let i = 0; i < 200; i++) {
            let dices = [];
            for (let j = 0; j < 3; j++) {
                // Chọn mặt dựa trên tần suất (có thể làm trọng số)
                let total = freq.reduce((a, b) => a + b, 0);
                let rand = Math.random() * total;
                let cum = 0;
                for (let k = 0; k < 6; k++) {
                    cum += freq[k];
                    if (rand <= cum) {
                        dices.push(k + 1);
                        break;
                    }
                }
                if (dices.length === j + 1) break;
            }
            if (dices.length === 3) {
                let s = dices.reduce((a, b) => a + b, 0);
                if (Math.abs(s - sum) <= 2) return dices;
            }
        }
        return [3, 3, 4];
    }

    // Tự học: so sánh dự đoán với kết quả thực tế
    learn(actualResult) {
        if (!this.lastPrediction) return;
        const predicted = this.lastPrediction.result;
        const correct = (actualResult === predicted);
        this.totalPredictions++;
        if (correct) this.correctPredictions++;

        // Điều chỉnh trọng số dựa trên độ chính xác
        const accuracy = this.correctPredictions / this.totalPredictions;
        if (accuracy < 0.5) {
            this.weights.markov += 0.01;
            this.weights.frequency += 0.005;
            this.weights.trend += 0.005;
            this.weights.pattern += 0.005;
            this.weights.break += 0.01;
            this.weights.diceLogic += 0.01;
            this.weights.random -= 0.02;
            // Chuẩn hóa
            const total = this.weights.markov + this.weights.frequency + this.weights.trend +
                          this.weights.pattern + this.weights.break + this.weights.diceLogic + this.weights.random;
            for (let key in this.weights) {
                this.weights[key] /= total;
            }
        }
        this.lastPrediction = null;
    }
}

// Khởi tạo AI
const ai = new SuperGemini();

// ============================================================
// HÀM CHẠY DỰ ĐOÁN
// ============================================================
function runAdvancedPrediction() {
    if (sessionData.history.length === 0) return;

    ai.updateHistory(sessionData.history);

    // Tự học nếu có dự đoán trước
    const latestResult = sessionData.history[0].result;
    if (ai.lastPrediction) {
        ai.learn(latestResult);
    }

    const pred = ai.predict();

    const currentSession = sessionData.history[0] || null;
    const previousSession = sessionData.history[1] || null;

    prediction.currentSessionId = currentSession ? currentSession.id : null;
    prediction.predictedResult = pred.result;
    prediction.predictedDices = pred.dices;
    prediction.confidence = pred.confidence;

    // Phân tích chi tiết
    const streak = ai.memory.streak;
    const recentTai = ai.memory.recentTai;
    const recentXiu = ai.memory.recentXiu;
    prediction.analysis = `🔍 Phân tích siêu VIP: Tổng ${sessionData.history.length} phiên. ` +
        `Chuỗi hiện tại: ${streak} phiên ${ai.memory.lastResult}. ` +
        `20 phiên gần: Tài ${recentTai}, Xỉu ${recentXiu}. ` +
        `Dự báo: ${pred.result} với độ tin cậy ${pred.confidence}%.`;

    sessionData.lastUpdate = new Date().toISOString();
}

// ============================================================
// ĐỊNH KỲ GỌI API (mỗi 2 giây)
// ============================================================
setInterval(async () => {
    await fetchSessions();
}, 2000);

fetchSessions();

// ============================================================
// ROUTE EXPRESS
// ============================================================
app.use(express.static('public'));

app.get('/api/current', (req, res) => {
    const current = sessionData.history[0] || null;
    const previous = sessionData.history[1] || null;
    res.json({
        success: true,
        currentSession: current,
        previousSession: previous,
        prediction: prediction,
        stat: sessionData.typeStat,
        lastUpdate: sessionData.lastUpdate,
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LC79 - Siêu VIP</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: #0b0e14; color: #e0e6f0; padding: 20px; display: flex; justify-content: center; min-height: 100vh; }
        .container { max-width: 800px; width: 100%; }
        .card { background: rgba(18, 24, 38, 0.85); backdrop-filter: blur(10px); border-radius: 30px; padding: 24px 28px; margin-bottom: 20px; border: 1px solid rgba(255,215,0,0.15); box-shadow: 0 8px 30px rgba(0,0,0,0.6); }
        .header { text-align: center; border-bottom: 1px solid #1e2842; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 2.2rem; font-weight: 700; background: linear-gradient(135deg, #f7d94a, #f0b82b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 30px #f7b32b55; }
        .header .admin { color: #8892b0; font-size: 0.9rem; margin-top: 4px; }
        .header .admin span { color: #f7c948; }
        .flex-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .info-item { background: #111827; padding: 12px 18px; border-radius: 20px; border-left: 4px solid #f7c948; flex: 1; min-width: 150px; }
        .info-item .label { font-size: 0.75rem; color: #7d89b0; text-transform: uppercase; }
        .info-item .value { font-size: 1.2rem; font-weight: 600; margin-top: 4px; }
        .highlight-tai { color: #4aff8b; }
        .highlight-xiu { color: #ff6b7c; }
        .dice-group { display: flex; gap: 12px; justify-content: center; margin: 10px 0; }
        .dice { width: 50px; height: 50px; background: #1b233b; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 700; color: #f0f4ff; border: 1px solid #2f3b62; box-shadow: 0 4px 0 #0b0f1a; }
        .dice.tai { border-color: #4aff8b; box-shadow: 0 0 20px #4aff8b44; }
        .dice.xiu { border-color: #ff6b7c; box-shadow: 0 0 20px #ff6b7c44; }
        .confidence-bar { width: 100%; height: 10px; background: #1f2742; border-radius: 20px; margin: 10px 0; overflow: hidden; }
        .confidence-fill { height: 100%; background: linear-gradient(90deg, #ff6b7c, #f7c948, #4aff8b); border-radius: 20px; transition: width 0.5s; }
        .btn-copy { background: #252f4a; border: none; color: #c4cff0; padding: 10px 24px; border-radius: 60px; font-weight: 600; cursor: pointer; border: 1px solid #3f4a6b; transition: 0.3s; margin-top: 10px; }
        .btn-copy:hover { background: #2f3d62; transform: scale(1.02); }
        .update-time { text-align: right; font-size: 0.75rem; color: #5f6b8a; margin-top: 10px; }
        .footer { text-align: center; color: #3c4870; font-size: 0.8rem; border-top: 1px solid #1e2842; padding-top: 15px; margin-top: 10px; }
        @media (max-width: 600px) { .container { padding: 0; } .card { padding: 16px; } .flex-row { flex-direction: column; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>🎲 LC79 - SIÊU VIP</h1>
                <div class="admin">Admin: <span>@DENIUS09</span></div>
            </div>

            <!-- Phiên trước -->
            <div id="previousSession" class="card" style="margin-bottom:10px; padding:16px 20px;">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap;">
                    <div><span class="label">Phiên trước</span> <span id="prevId" style="font-weight:600;">---</span></div>
                    <div><span class="label">Kết quả</span> <span id="prevResult" style="font-weight:700;">---</span></div>
                    <div><span class="label">Điểm</span> <span id="prevPoint">---</span></div>
                </div>
                <div class="dice-group" id="prevDices"></div>
            </div>

            <!-- Phiên hiện tại + Dự đoán -->
            <div id="currentSession" class="card" style="border-color: #f7c94888; padding:16px 20px;">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap;">
                    <div><span class="label">Phiên hiện tại</span> <span id="currId" style="font-weight:600;">---</span></div>
                    <div><span class="label">Dự đoán</span> <span id="predResult" style="font-weight:700; font-size:1.2rem;">---</span></div>
                    <div><span class="label">Độ tin cậy</span> <span id="predConfidence" style="font-weight:700;">---</span></div>
                </div>
                <div class="dice-group" id="predDices"></div>
                <div class="confidence-bar">
                    <div id="confidenceFill" class="confidence-fill" style="width:50%;"></div>
                </div>
                <div id="analysisText" style="color:#8892b0; font-size:0.9rem; margin-top:6px;"></div>
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">
                    <button class="btn-copy" onclick="copyData()">📋 Copy to Clipboard</button>
                </div>
            </div>

            <div class="update-time" id="updateTime">Đang cập nhật...</div>
            <div class="footer">⚡ AI SUPER GEMINI · Tự học mỗi phiên ⚡</div>
        </div>
    </div>

    <script>
        function fetchData() {
            fetch('/api/current')
                .then(res => res.json())
                .then(data => {
                    if (!data.success) return;
                    const { currentSession, previousSession, prediction, lastUpdate } = data;

                    // Cập nhật phiên trước
                    if (previousSession) {
                        document.getElementById('prevId').textContent = '#' + previousSession.id;
                        const res = previousSession.result;
                        document.getElementById('prevResult').textContent = res;
                        document.getElementById('prevResult').className = res === 'TAI' ? 'highlight-tai' : 'highlight-xiu';
                        document.getElementById('prevPoint').textContent = previousSession.point + ' | ' + previousSession.dices.join(', ');
                        const prevDicesDiv = document.getElementById('prevDices');
                        prevDicesDiv.innerHTML = previousSession.dices.map(function(d) {
                            return '<div class="dice">' + d + '</div>';
                        }).join('');
                    }

                    // Cập nhật phiên hiện tại
                    if (currentSession) {
                        document.getElementById('currId').textContent = '#' + currentSession.id;
                    } else {
                        document.getElementById('currId').textContent = '---';
                    }

                    // Dự đoán
                    const pred = prediction;
                    if (pred && pred.predictedResult) {
                        const result = pred.predictedResult;
                        document.getElementById('predResult').textContent = result;
                        document.getElementById('predResult').className = result === 'TAI' ? 'highlight-tai' : 'highlight-xiu';
                        document.getElementById('predConfidence').textContent = pred.confidence + '%';
                        document.getElementById('confidenceFill').style.width = pred.confidence + '%';
                        const predDicesDiv = document.getElementById('predDices');
                        if (pred.predictedDices && pred.predictedDices.length === 3) {
                            predDicesDiv.innerHTML = pred.predictedDices.map(function(d) {
                                return '<div class="dice">' + d + '</div>';
                            }).join('');
                        } else {
                            predDicesDiv.innerHTML = '<div class="dice">?</div><div class="dice">?</div><div class="dice">?</div>';
                        }
                        document.getElementById('analysisText').textContent = pred.analysis || 'Phân tích từ AI siêu thông minh.';
                    } else {
                        document.getElementById('predResult').textContent = 'Đang chờ...';
                        document.getElementById('predConfidence').textContent = '--%';
                        document.getElementById('confidenceFill').style.width = '0%';
                        document.getElementById('predDices').innerHTML = '<div class="dice">?</div><div class="dice">?</div><div class="dice">?</div>';
                    }

                    if (lastUpdate) {
                        document.getElementById('updateTime').textContent = 'Cập nhật lúc: ' + new Date(lastUpdate).toLocaleString();
                    }
                })
                .catch(err => console.error('Lỗi fetch:', err));
        }

        function copyData() {
            const prevId = document.getElementById('prevId').textContent;
            const prevResult = document.getElementById('prevResult').textContent;
            const prevPoint = document.getElementById('prevPoint').textContent;
            const currId = document.getElementById('currId').textContent;
            const predResult = document.getElementById('predResult').textContent;
            const predConfidence = document.getElementById('predConfidence').textContent;
            const predDices = document.getElementById('predDices').innerText.replace(/\\s/g, ', ');

            const text = "🔮 LC79 - DỰ ĐOÁN SIÊU VIP 🔮\n" +
                         "Phiên trước: " + prevId + "\n" +
                         "Kết quả: " + prevResult + " | Điểm: " + prevPoint + "\n\n" +
                         "Phiên hiện tại: " + currId + "\n" +
                         "Dự đoán: " + predResult + "  |  Độ tin cậy: " + predConfidence + "\n" +
                         "Xúc xắc: " + predDices + "\n\n" +
                         "Admin: @DENIUS09\n" +
                         "--- AI SUPER GEMINI ---";

            navigator.clipboard.writeText(text).then(function() {
                alert('Đã sao chép dữ liệu!');
            }).catch(function(err) {
                alert('Không thể copy, hãy copy thủ công.');
                console.error(err);
            });
        }

        fetchData();
        setInterval(fetchData, 2000);
    </script>
</body>
</html>
    `);
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
app.listen(PORT, () => {
    console.log('LC79 API đang chạy trên cổng ' + PORT);
    console.log('Truy cập http://localhost:' + PORT + ' để xem giao diện.');
});

process.on('SIGINT', () => {
    console.log('Đang dừng LC79...');
    process.exit();
});