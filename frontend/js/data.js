/* Dragon Bytes — static content for the community pages.
   This is presentational/marketing copy, kept on the frontend since it
   never changes per-user (unlike challenge data, which is server-side). */

const SITE_DATA = {
  activities: [
    ["⚔️", "CTF Competitions", "Weekly internal CTF challenges and participation in global competitions like PicoCTF, HTB, and DEF CON CTF."],
    ["🛠️", "Workshops", "Hands-on sessions covering reverse engineering, web exploitation, binary exploitation, and AI security."],
    ["🔬", "Research Projects", "Collaborative research in AI-assisted vulnerability discovery, adversarial ML, and digital forensics."],
    ["💼", "Industry Mentorship", "Connect with security professionals, red teamers, and AI engineers through our mentor program."],
    ["📖", "Study Groups", "Structured learning cohorts for OSCP, CEH, eJPT, and AI certification tracks."],
    ["🌐", "Open Source", "We build and contribute to open-source security tools, write-ups, and learning materials."],
  ],

  categories: [
    ["🌐", "Web Exploitation", "SQL injection, XSS, CSRF, SSRF, authentication bypass"],
    ["🔐", "Cryptography", "Caesar, RSA, AES, hash cracking, encoding puzzles"],
    ["🔍", "Digital Forensics", "Hex analysis, metadata, memory dumps, log analysis"],
    ["💻", "Binary / Pwn", "Buffer overflow, ROP chains, format strings, shellcode"],
    ["🖼️", "Steganography", "LSB extraction, image analysis, audio stego, hidden files"],
    ["🤖", "AI & ML Security", "Adversarial attacks, prompt injection, model extraction"],
    ["🕵️", "OSINT", "Social engineering, passive recon, geolocation, data leaks"],
  ],

  team: [
    ["🐉", "Arjun Krishnan", "President & Red Team Lead", "OSCP · HTB Pro Hacker"],
    ["🛡️", "Priya Venkat", "AI Security Research Lead", "Google Summer of Code Alum"],
    ["🔐", "Rahul Mehta", "Cryptography & CTF Lead", "Top 100 CTFtime Global"],
    ["💻", "Ananya Suresh", "Software & DevSecOps", "Open-source Contributor"],
    ["🔬", "Kiran Patel", "Forensics & Malware Analysis", "SANS GREM Candidate"],
    ["🌐", "Divya Nair", "Web Security & OSINT", "Bug Bounty Hunter"],
  ],

  achievements: [
    ["🥇", "PicoCTF 2024", "Top 5% Nationally — solved 42 of 50 challenges"],
    ["🏆", "Hack The Box Student", "Collective rank: #12 in India (2024)"],
    ["📜", "Research Publication", "AI-Driven Vulnerability Detection — IEEE Student Paper"],
    ["🎓", "Workshop Conducted", "500+ students trained across 12 college workshops"],
    ["🛠️", "Open Source Tool", "DragonScan v1.0 — 800+ GitHub stars"],
    ["🌍", "CTFtime Ranking", "Global rank entered Top 500 in first season"],
  ],

  events: [
    ["Jul 12, 2025", "🔐 Web Exploitation Bootcamp", "3-day intensive — HTTP internals to OWASP Top 10", "Registering"],
    ["Aug 03, 2025", "⚔️ Dragon Bytes CTF Season 3", "Internal competition — 30 challenges, prizes for top 3", "Open"],
    ["Aug 20, 2025", "🤖 AI Red Teaming Workshop", "Prompt injection, model extraction, adversarial examples", "Soon"],
    ["Sep 05, 2025", "🌍 HackFest 2025 — Team Tryouts", "Select 6 members to represent DB at national finals", "Coming"],
  ],

  projects: [
    ["🔍", "DragonScan", "Python", "Automated recon & vulnerability scanner with AI triage"],
    ["🧩", "CipherLab", "JavaScript", "Interactive cryptography playground for students"],
    ["🛡️", "PhishGuard", "Python/ML", "ML-powered phishing URL detection with 97% accuracy"],
    ["📡", "NetShadow", "Go", "Passive network traffic anomaly detection tool"],
    ["🤖", "PromptShield", "Python", "LLM prompt injection detection and filtering layer"],
    ["📝", "CTF Writeups", "Markdown", "100+ solved challenge write-ups on our public wiki"],
  ],

  joinInterests: ["Cybersecurity", "AI & ML", "Software Development", "Research", "Bug Bounty", "CTF Competitions"],

  categoryOptions: [
    ["web", "🌐 Web Exploitation"],
    ["crypto", "🔐 Cryptography"],
    ["forensics", "🔍 Digital Forensics"],
    ["binary", "💻 Binary / Pwn"],
    ["stego", "🖼️ Steganography"],
    ["ai_ml", "🤖 AI & ML Security"],
    ["osint", "🕵️ OSINT"],
  ],

  resourceTabs: {
    "getting-started": {
      title: "Where to Begin",
      cards: [
        ["📘 Beginner Roadmap", "Start with Linux basics → Networking fundamentals → Python scripting → Web security basics → Your first CTF"],
        ["🎮 Platforms to Practice", "OverTheWire · PicoCTF · HackTheBox Starting Point · TryHackMe · CryptoHack"],
        ["📺 Recommended Channels", "John Hammond · IppSec · LiveOverflow · The Cyber Mentor · NetworkChuck"],
      ]
    },
    "cybersecurity": {
      title: "Cybersecurity Learning Paths",
      cards: [
        ["🌐 Web Security", "PortSwigger Web Academy (free) · OWASP Testing Guide · Bug Bounty Bootcamp by Vickie Li"],
        ["💻 Binary / Pwn", "pwn.college · CS:APP textbook · ROP Emporium · LiveOverflow Binary Hacking"],
        ["🔐 Cryptography", "CryptoPals challenges · CryptoHack · Serious Cryptography by Aumasson"],
        ["🔍 Forensics", "Digital Forensics with Kali Linux · Belkasoft CTF · DFIR.training"],
      ]
    },
    "ai-security": {
      title: "AI & ML Security",
      cards: [
        ["🤖 Adversarial ML", "Adversarial Robustness Toolbox (IBM) · CleverHans · Foolbox · NIST AI RMF"],
        ["💬 LLM Security", "OWASP Top 10 for LLMs · PromptBench · Garak LLM Vulnerability Scanner"],
        ["📰 Research Papers", "Intriguing Properties of Neural Networks (Szegedy) · Universal Adversarial Perturbations"],
      ]
    },
    "tools": {
      title: "Essential Security Tools",
      cards: [
        ["🔎 Reconnaissance", "nmap · masscan · subfinder · amass · shodan · theHarvester"],
        ["🌐 Web Testing", "Burp Suite Community · OWASP ZAP · ffuf · gobuster · sqlmap · nikto"],
        ["💻 Binary Analysis", "pwndbg · radare2 · Ghidra · angr · ROPgadget · pwntools"],
        ["🔐 Crypto & Forensics", "CyberChef · hashcat · john · volatility3 · binwalk · steghide · exiftool"],
      ]
    },
    "ctf-practice": {
      title: "Practice Platforms",
      cards: [
        ["🏆 Competitive CTF", "CTFtime.org (upcoming events) · picoCTF · PwnTillDawn · CSAW CTF"],
        ["🎯 Year-Round Practice", "HackTheBox · TryHackMe · VulnHub · ImmersiveLabs · RingZer0 CTF"],
        ["📝 Write-ups & Walkthroughs", "Dragon Bytes Wiki · IppSec.rocks · CTFtime Write-ups · GitHub Search: CTF writeup"],
      ]
    }
  }
};
