import { MapPin, Phone, Clock, Instagram, Facebook, MessageCircle } from "lucide-react"
import Link from "next/link"

export function ClientFooter() {
  return (
    <footer className="mt-16 border-t border-border/40 bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Informações de Contato */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground">Contato</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Endereço</p>
                  <p>Rua Marcelino Nogueira, 177</p>
                  <p>Ronda - Ponta Grossa, PR</p>
                  <p>CEP: 84051-240</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Telefone</p>
                  <p>(42) 98434-7835</p>
                </div>
              </div>
            </div>
          </div>

          {/* Horário de Funcionamento */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground">Horário</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Segunda a Sexta</p>
                  <p>18:00 - 23:00</p>
                </div>
              </div>
              <div className="flex items-start gap-3 ml-8">
                <div>
                  <p className="font-medium text-foreground">Sábado e Domingo</p>
                  <p>18:00 - 00:00</p>
                </div>
              </div>
            </div>
          </div>

          {/* Redes Sociais */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground">Redes Sociais</h3>
            <p className="text-sm text-muted-foreground mb-4">Siga-nos nas redes sociais</p>
            <div className="flex gap-4">
              <Link
                href="https://instagram.com/mrsmashstreet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </Link>

              <Link
                href="https://facebook.com/mrsmashstreet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </Link>

              <Link
                href="https://wa.me/5542984347835"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Mr. Smash Street. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
