#!/bin/bash

# Script para configurar variables de entorno en Vercel
echo "Configurando variables de entorno en Vercel..."

# Leer variables del archivo .env.local
while IFS='=' read -r key value; do
  # Saltar líneas vacías y comentarios
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  
  # Filtrar solo las variables de Supabase
  case "$key" in
    NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)
      echo ""
      echo "Agregando $key..."
      echo "$value" | vercel env add "$key" production
      ;;
  esac
done < .env.local

echo ""
echo "✅ Variables de entorno configuradas"

