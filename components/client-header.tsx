import Image from "next/image"
import Link from "next/link"
import { Flame } from "lucide-react"

export function ClientHeader() {
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
              <p className="text-xs text-muted-foreground">Burger Joint • Est. 2024</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/cardapio" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Cardápio
            </Link>
            <Link
              href="/meu-pedido"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Meu Pedido
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
