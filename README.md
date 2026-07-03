# VAST Challenge 2026 – Mini-Challenge 2

**Team Members**
- Francisco Calle — UTEC (francisco.calle.o@utec.edu.pe)
- Anthony Roca — UTEC (anthony.roca@utec.edu.pe)

---

## About the Challenge

[VAST Challenge 2026 – Mini-Challenge 2](https://vast-challenge.github.io/2026/MC2.html)

An anomalous post was made on *SaidIT* by John Windward, an employee of Tenant Thread, a company that operates a complex multi-agent AI system where each employee has an autonomous agent capable of delegating tasks to others. The goal is to build a visual analytics tool to investigate why the post occurred, trace the origin of its content, identify historical patterns, and propose a remedy to prevent recurrence.

---

## Our Approach

We built an interactive visual analytics dashboard in D3.js to explore the propagation patterns behind the anomalous posts. The dashboard lets you filter by campaign, navigate the full event timeline with a range slider, and drill down into individual agents. It includes a radial tree to map agent relationships, a network topology to trace hop-by-hop propagation sequences, and a leaks panel that surfaces key file-access events linked to each post.

---

## Tools Used

- D3.js v7
- JavaScript (vanilla)
- HTML / CSS
- Python (data preprocessing)

---

## How to Run

No installation required. The dashboard runs entirely in the browser.

1. Clone or download this repository
2. Make sure all files are in the same directory (including the `js/` folder and JSON data files)
3. Open `index.html` in any modern browser (Chrome or Firefox recommended)

> Note: some browsers block local file loading due to CORS policies. If the dashboard doesn't load, serve it locally with:
> ```bash
> python3 -m http.server 8000
> ```
> Then open `http://localhost:8000` in your browser.

---

## Video

[Link coming soon]

---

## Repository Structure

```
├── index.htm           # VAST Challenge answer sheet
├── index.html          # Interactive dashboard
├── style.css           # Dashboard styles
├── js/
│   ├── app.js
│   ├── charts.js
│   ├── state.js
│   └── ui.js
├── images/             # Figures referenced in the answer sheet
├── mc2_m_data.json
├── propagation_events.json
├── network_data.json
├── org_chart.json
└── README.md
```

---
