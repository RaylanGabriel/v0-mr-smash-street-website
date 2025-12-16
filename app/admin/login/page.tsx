"use client"

import type React from "react"

import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"
import { Lock, Flame } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createBrowserClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/admin")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Erro ao fazer login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 mb-4">
            <Image src="/logo.png" alt="Mr. Smash Street Logo" fill className="object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 flex items-center gap-2">
            <Flame className="w-8 h-8 text-primary" />
            Mr. Smash Street
          </h1>
          <p className="text-muted-foreground text-center">Acesso Administrativo</p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4 mx-auto">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl text-center">Login do Administrador</CardTitle>
            <CardDescription className="text-center">Digite suas credenciais para acessar o painel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@mrsmashstreet.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </div>
              <div className="mt-6 text-center">
                <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ← Voltar para página inicial
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
