"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Flame, User, LogOut, LogIn } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export function ClientHeader() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient()
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push("/")
    router.refresh()
  }

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-16 h-16 md:w-20 md:h-20">
              <Image src="/logo.png" alt="Mr. Smash Street" fill className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                Mr. Smash Street
                <Flame className="w-5 h-5 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">Burger Joint - Est. 2024</p>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            <Link href="/cardapio" className="text-sm font-medium text-foreground hover:text-primary transition-colors hidden md:block">
              Cardapio
            </Link>
            
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/meu-pedido"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors hidden md:block"
                >
                  Meus Pedidos
                </Link>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium max-w-[100px] truncate">
                    {user.user_metadata?.full_name || user.email?.split("@")[0]}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline ml-2">Sair</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/cliente/login">
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </Link>
                </Button>
                <Button size="sm" asChild className="hidden md:flex">
                  <Link href="/cliente/cadastro">
                    Criar conta
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
