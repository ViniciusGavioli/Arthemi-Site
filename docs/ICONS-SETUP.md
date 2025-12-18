# Ícones Necessários - Espaço Arthemi

## 📋 Lista de Arquivos

Para completar a configuração de ícones, você precisa criar os seguintes arquivos na pasta `public/icons/`:

### Favicons (obrigatórios)
| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `favicon-16x16.png` | 16x16 | Favicon pequeno para abas |
| `favicon-32x32.png` | 32x32 | Favicon padrão |

### Apple Touch Icon (obrigatório para iOS)
| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `apple-touch-icon.png` | 180x180 | Ícone ao adicionar na tela inicial do iPhone/iPad |

### Ícones do Manifest (para PWA)
| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `icon-72x72.png` | 72x72 | Android legacy |
| `icon-96x96.png` | 96x96 | Android legacy |
| `icon-128x128.png` | 128x128 | Chrome Web Store |
| `icon-144x144.png` | 144x144 | Windows tile |
| `icon-152x152.png` | 152x152 | iPad touch icon |
| `icon-192x192.png` | 192x192 | Android home screen |
| `icon-384x384.png` | 384x384 | Android splash screen |
| `icon-512x512.png` | 512x512 | Android splash + PWA |

### Favicon raiz (obrigatório)
| Arquivo | Localização | Descrição |
|---------|-------------|-----------|
| `favicon.ico` | `public/favicon.ico` | Formato ICO tradicional (pode conter 16x16 e 32x32) |

## 🎨 Cores do Tema

Use estas cores para consistência com o site:
- **Primary (Marrom):** `#8B7355`
- **Background (Bege claro):** `#FAF8F5`
- **Accent (Marrom escuro):** `#5D4E37`

## 🛠️ Como Gerar

### Opção 1: RealFaviconGenerator.net
1. Acesse https://realfavicongenerator.net
2. Faça upload de um logo quadrado (mínimo 512x512)
3. Configure as cores do tema
4. Baixe o pacote e extraia em `public/icons/`

### Opção 2: Canva ou Figma
1. Crie um design quadrado com fundo `#FAF8F5`
2. Exporte em todos os tamanhos listados acima

### Opção 3: ImageMagick (CLI)
```bash
# A partir de uma imagem base icon-512x512.png
convert icon-512x512.png -resize 192x192 icon-192x192.png
convert icon-512x512.png -resize 180x180 apple-touch-icon.png
convert icon-512x512.png -resize 32x32 favicon-32x32.png
convert icon-512x512.png -resize 16x16 favicon-16x16.png
```

## ✅ Verificação

Após adicionar os ícones, verifique:
1. Abra o site no navegador
2. A aba deve mostrar o favicon
3. No celular, adicione à tela inicial para testar o apple-touch-icon
4. DevTools > Application > Manifest para verificar o manifest.json
