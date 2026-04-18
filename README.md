# 🏋️ Vitalidade 40+ | IA Personal Trainer Premium

![Status](https://img.shields.io/badge/Status-Ativo-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![PWA](https://img.shields.io/badge/PWA-Ready-purple)

**Personal Trainer virtual com Inteligência Artificial especializado em homens acima de 40 anos.**

🔗 **Demo:** [vitalidade-app.vercel.app](https://vitalidade-app.vercel.app)

---

## 📱 Preview

| Tela Inicial | Chat IA | Programa |
|:-------------:|:-------:|:--------:|
| ![Home](https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=300&h=600&fit=crop) | ![Chat](https://images.unsplash.com/photo-1571019614242-c5c3dee35812?w=300&h=600&fit=crop) | ![Program](https://images.unsplash.com/photo-1534438327276-14e5300c3a5b?w=300&h=600&fit=crop) |

---

## 🚀 Funcionalidades

### 🧠 IA Coach Integrado
- Treinos personalizados via chat
- Programas semanais de 5 dias
- Análise de progresso com base em check-ins
- Adaptação automática para lesões (método BFR)

### 📊 Gerenciamento Completo
- Perfil biométrico (idade, peso, objetivo)
- Histórico de treinos
- Check-ins com RPE e fadiga
- Progressão visual

### 🏃 Foco em 40+
- Hipertrofia segura para meia-idade
- Redução de gordura visceral (HIIT)
- Método BFR para articulações
- Base científica embasada

### 📱 PWA (Progressive Web App)
- Instalável no celular/desktop
- Funciona offline (parcialmente)
- Push notifications
- Sincronização na nuvem

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | HTML5, CSS3, JavaScript Vanilla, Tailwind CSS |
| **Backend** | Supabase (PostgreSQL, Auth) |
| **IA** | Groq API (Llama 3.3 70B) |
| **Hosting** | Vercel |
| **PWA** | Service Worker, Web Manifest |

---

## 📁 Estrutura do Projeto
vitalidade-app/ ├── index.html # Aplicação principal (SPA) ├── manifest.json # Configuração PWA ├── sw.js # Service Worker ├── vercel.json # Configuração Vercel ├── api/ │ └── chat.js # Serverless function (IA) └── README.md # Documentação


---

## 🔧 Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/Taurinas83/vitalidade-app.git
cd vitalidade-app


