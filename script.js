document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. MOTOR SPECIFICATIONS (Explicitly defined) ---
    const CONSTANTS = {
        Ra_int: 0.5,      // Internal Armature Resistance (Ohms)
        Rf_int: 200,      // Internal Field Resistance (Ohms)
        Ia_const: 2.0,    // Constant Load Current (Amps) - Assumption for simplifiction
        
        // CALIBRATION CONSTANT (K)
        // Derived from rated conditions: V=220, Ra_ext=0, Rf_ext=0
        // If = 220 / 200 = 1.1 A
        // Eb = 220 - (2 * 0.5) = 219 V
        // Desired Speed = 1500 RPM
        // Formula: N = K * (Eb / If)  ->  1500 = K * (219 / 1.1)
        // K = (1500 * 1.1) / 219 ≈ 7.534
        Speed_Constant: 7.534 
    };

    // State Variables
    let state = {
        voltage: 220, ra_ext: 0, rf_ext: 0,
        if: 0, eb: 0, speed: 0, readingCount: 0
    };

    // --- 2. DOM Elements ---
    const els = {
        voltNum: document.getElementById('num-volt'),
        voltRange: document.getElementById('range-volt'),
        raNum: document.getElementById('num-ra'),
        raRange: document.getElementById('range-ra'),
        rfNum: document.getElementById('num-rf'),
        rfRange: document.getElementById('range-rf'),
        
        fan: document.getElementById('motor-fan'),
        rpmDisplay: document.getElementById('display-rpm'),
        ebDisplay: document.getElementById('display-eb'),
        ifDisplay: document.getElementById('display-if'),
        
        tableBody: document.getElementById('observation-body'),
        btnRecord: document.getElementById('btn-record'),
        btnReset: document.getElementById('btn-reset'),
        chartCanvas: document.getElementById('speedChart')
    };

    // --- 3. Chart Initialization ---
    let speedChart = new Chart(els.chartCanvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Speed (RPM)',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#06b6d4',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, beginAtZero: true }
            },
            plugins: { legend: { display: false } }
        }
    });

    // --- 4. PHYSICS ENGINE ---
    function calculatePhysics() {
        // A. Inputs
        const V = parseFloat(els.voltNum.value);
        const Ra_ext = parseFloat(els.raNum.value);
        const Rf_ext = parseFloat(els.rfNum.value);

        // B. Field Current Calculation
        // If = V / (Rf_internal + Rf_external)
        const Rf_total = CONSTANTS.Rf_int + Rf_ext;
        let If = V / Rf_total;

        // C. Back EMF Calculation
        // Eb = V - Ia * (Ra_internal + Ra_external)
        // Assumption: Ia is constant (Constant Torque Load)
        const Ra_total = CONSTANTS.Ra_int + Ra_ext;
        let Eb = V - (CONSTANTS.Ia_const * Ra_total);
        
        // Physics Constraint: Eb cannot be negative
        if (Eb < 0) Eb = 0;

        // D. Speed Calculation
        // N = K * (Eb / Flux) ... Assuming Flux ∝ If (Linear magnetic circuit)
        let N = 0;
        
        // Safety: Avoid divide by zero if If is 0
        if (If <= 0.001) {
            // If field is broken (open circuit), speed dangerously increases
            // In simulation, we cap it or set to 0 if power is off
            N = (V > 0) ? 6000 : 0; 
        } else {
            N = CONSTANTS.Speed_Constant * (Eb / If);
        }

        // Safety Caps
        if (N < 0) N = 0;
        if (N > 6000) N = 6000;

        // Update State
        state.voltage = V;
        state.ra_ext = Ra_ext;
        state.rf_ext = Rf_ext;
        state.if = If;
        state.eb = Eb;
        state.speed = Math.round(N);

        updateVisuals();
    }

    // --- 5. VISUALS ---
    function updateVisuals() {
        els.rpmDisplay.innerText = state.speed;
        els.ebDisplay.innerText = state.eb.toFixed(2);
        els.ifDisplay.innerText = state.if.toFixed(3);

        const fan = els.fan;
        if (state.speed > 10) {
            let duration = 60 / state.speed; 
            if(duration < 0.02) duration = 0.02; // Max animation speed cap
            fan.style.animation = `spin ${duration}s linear infinite`;
            fan.style.color = '#3b82f6';
        } else {
            fan.style.animation = 'none';
            fan.style.color = '#94a3b8';
        }
    }

    // --- 6. EVENT BINDING ---
    function bindInputs(range, num) {
        range.addEventListener('input', () => { num.value = range.value; calculatePhysics(); });
        num.addEventListener('input', () => {
            let val = parseFloat(num.value);
            if (val > parseFloat(range.max)) val = range.max;
            if (val < parseFloat(range.min)) val = range.min;
            range.value = val;
            calculatePhysics();
        });
    }

    bindInputs(els.voltRange, els.voltNum);
    bindInputs(els.raRange, els.raNum);
    bindInputs(els.rfRange, els.rfNum);

    // Record Data
    els.btnRecord.addEventListener('click', () => {
        state.readingCount++;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${state.readingCount}</td>
            <td>${state.voltage}</td>
            <td>${state.ra_ext.toFixed(1)}</td>
            <td>${state.rf_ext.toFixed(1)}</td>
            <td>${state.if.toFixed(3)}</td>
            <td>${state.eb.toFixed(1)}</td>
            <td style="color: var(--accent-blue); font-weight:bold">${state.speed}</td>
        `;
        els.tableBody.appendChild(row);
        els.tableBody.lastElementChild.scrollIntoView({ behavior: 'smooth' });

        speedChart.data.labels.push(state.readingCount);
        speedChart.data.datasets[0].data.push(state.speed);
        speedChart.update();
    });

    // Reset
    els.btnReset.addEventListener('click', () => {
        state.readingCount = 0;
        els.tableBody.innerHTML = '';
        speedChart.data.labels = [];
        speedChart.data.datasets[0].data = [];
        speedChart.update();
        
        els.voltNum.value = 220; els.voltRange.value = 220;
        els.raNum.value = 0; els.raRange.value = 0;
        els.rfNum.value = 0; els.rfRange.value = 0;
        calculatePhysics();
    });

    calculatePhysics();
});
