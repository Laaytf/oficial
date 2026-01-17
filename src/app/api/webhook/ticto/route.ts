import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Tipo para o payload do webhook da Ticto
interface TictoWebhookPayload {
  customer?: {
    email?: string;
  };
  buyer?: {
    email?: string;
  };
  data?: {
    customer?: {
      email?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    // Usa apenas variáveis públicas disponíveis no runtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Valida se as variáveis existem
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Variáveis de ambiente do Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    // Cria cliente Supabase usando anon key
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Parse do payload JSON enviado pela Ticto
    const payload: TictoWebhookPayload = await request.json();

    // Extrai o e-mail de qualquer um dos caminhos possíveis
    const email = 
      payload.customer?.email || 
      payload.buyer?.email || 
      payload.data?.customer?.email;

    // Valida se o e-mail foi encontrado
    if (!email) {
      return NextResponse.json(
        { error: 'E-mail não encontrado no payload' },
        { status: 400 }
      );
    }

    // Valida formato do e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de e-mail inválido' },
        { status: 400 }
      );
    }

    // Senha temporária padrão
    const temporaryPassword = 'Acesso123@';

    // Tenta criar o usuário usando signUp()
    const { data, error } = await supabase.auth.signUp({
      email,
      password: temporaryPassword,
      options: {
        emailRedirectTo: undefined, // Não redirecionar após confirmação
      }
    });

    // Se o erro for "usuário já existe", retorna sucesso
    if (error) {
      if (error.message.includes('already registered') || 
          error.message.includes('already exists') ||
          error.message.includes('User already registered')) {
        return NextResponse.json({ success: true });
      }
      
      // Se for outro tipo de erro, loga e retorna erro
      console.error('Erro ao criar usuário no Supabase:', error);
      return NextResponse.json(
        { error: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Sucesso - usuário criado
    console.log('Usuário criado com sucesso:', data.user?.email);
    
    // Nota: Com signUp() usando anon key, o Supabase enviará um e-mail de confirmação
    // automaticamente se a configuração "Enable email confirmations" estiver ativa.
    // Para confirmar automaticamente sem e-mail, seria necessário usar admin API
    // (que requer service role key).
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro no webhook Ticto:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}
