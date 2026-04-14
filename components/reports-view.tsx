"use client"

import { useState, useMemo } from "react"
import type { OrderWithItems } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { format, startOfDay, endOfDay, isWithinInterval, parseISO, isAfter } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar, DollarSign, ShoppingBag, TrendingUp, Search, X, Loader2 } from "lucide-react"

interface ReportsViewProps {
  orders: OrderWithItems[]
}

export function ReportsView({ orders }: ReportsViewProps) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [appliedStartDate, setAppliedStartDate] = useState("")
  const [appliedEndDate, setAppliedEndDate] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)

  const validateDates = () => {
    if (startDate && endDate) {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      if (isAfter(start, end)) {
        setDateError("A data inicial não pode ser maior que a data final")
        return false
      }
    }
    setDateError(null)
    return true
  }

  const handleSearch = () => {
    if (!validateDates()) return
    
    setIsSearching(true)
    // Simula um pequeno delay para feedback visual
    setTimeout(() => {
      setAppliedStartDate(startDate)
      setAppliedEndDate(endDate)
      setIsSearching(false)
    }, 300)
  }

  const handleClearFilters = () => {
    setStartDate("")
    setEndDate("")
    setAppliedStartDate("")
    setAppliedEndDate("")
    setDateError(null)
  }

  const hasFilters = appliedStartDate || appliedEndDate
  const hasInputDates = startDate || endDate

  const filteredOrders = useMemo(() => {
    if (!appliedStartDate && !appliedEndDate) return orders

    return orders.filter((order) => {
      const orderDate = parseISO(order.created_at)

      if (appliedStartDate && appliedEndDate) {
        return isWithinInterval(orderDate, {
          start: startOfDay(parseISO(appliedStartDate)),
          end: endOfDay(parseISO(appliedEndDate)),
        })
      } else if (appliedStartDate) {
        return orderDate >= startOfDay(parseISO(appliedStartDate))
      } else if (appliedEndDate) {
        return orderDate <= endOfDay(parseISO(appliedEndDate))
      }

      return true
    })
  }, [orders, appliedStartDate, appliedEndDate])

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total_price), 0)
    const completedOrders = filteredOrders.filter((o) => o.status === "delivered").length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Itens mais vendidos
    const itemCounts: Record<string, { name: string; count: number }> = {}
    filteredOrders.forEach((order) => {
      order.order_items.forEach((item) => {
        const itemName = item.menu_items.name
        if (!itemCounts[itemName]) {
          itemCounts[itemName] = { name: itemName, count: 0 }
        }
        itemCounts[itemName].count += item.quantity
      })
    })

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalOrders,
      totalRevenue,
      completedOrders,
      avgOrderValue,
      topItems,
    }
  }, [filteredOrders])

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filtrar por Data
          </CardTitle>
          <CardDescription>Selecione um período para análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input 
                id="startDate" 
                type="date" 
                value={startDate} 
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDateError(null)
                }}
                className={dateError ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDateError(null)
                }}
                className={dateError ? "border-destructive" : ""}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !hasInputDates}
                className="flex-1"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Pesquisar
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                disabled={!hasFilters && !hasInputDates}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
          {dateError && (
            <p className="text-sm text-destructive mt-2">{dateError}</p>
          )}
          {hasFilters && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Exibindo resultados de{" "}
                <span className="font-medium text-foreground">
                  {appliedStartDate ? format(parseISO(appliedStartDate), "dd/MM/yyyy", { locale: ptBR }) : "início"}
                </span>
                {" "}até{" "}
                <span className="font-medium text-foreground">
                  {appliedEndDate ? format(parseISO(appliedEndDate), "dd/MM/yyyy", { locale: ptBR }) : "hoje"}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.completedOrders} concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">R$ {stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">R$ {stats.avgOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Por pedido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">
              {stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pedidos entregues</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Itens */}
      <Card>
        <CardHeader>
          <CardTitle>Itens Mais Vendidos</CardTitle>
          <CardDescription>Top 5 do período</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-4">
              {stats.topItems.map((item, index) => (
                <div key={item.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.count} {item.count === 1 ? "unidade" : "unidades"}
                    </p>
                  </div>
                  <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(item.count / (stats.topItems[0]?.count || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pedidos</CardTitle>
          <CardDescription>
            {filteredOrders.length} {filteredOrders.length === 1 ? "pedido" : "pedidos"} no período
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum pedido encontrado</p>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="font-semibold">Pedido #{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">R$ {order.total_price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.order_items.map((item) => (
                      <span key={item.id} className="mr-2">
                        {item.quantity}x {item.menu_items.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
