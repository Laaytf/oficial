'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  PieChart, 
  Settings, 
  Plus, 
  Minus,
  Filter,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Download,
  Eye,
  MapPin,
  Clock,
  X,
  Edit,
  Trash2,
  LogOut,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Pie, Tooltip, Legend } from 'recharts'
import { toast } from 'sonner'

// Tipos
interface Transaction {
  id: number
  type: 'income' | 'expense'
  amount: number
  category: string
  category_id?: number
  description: string
  date: string
  status: string
  location: string
  time: string
  method: string
}

interface Category {
  id: number
  name: string
  budget: number
  spent: number
  color: string
  icon: string
}

interface UserProfile {
  email: string | null
}

export default function FinancialPlatform() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<UserProfile>({ email: null })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false)
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false)
  const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false)
  const [isDeleteTransactionOpen, setIsDeleteTransactionOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [dateFilter, setDateFilter] = useState('30-days')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false)
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  
  // Estados para "Ver mais / Ver menos"
  const [showAllCategorySpending, setShowAllCategorySpending] = useState(false)
  const [showAllBudgetControl, setShowAllBudgetControl] = useState(false)
  
  // Estados do formulário de nova transação
  const [newTransaction, setNewTransaction] = useState({
    type: '',
    amount: '',
    category_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    method: ''
  })

  // Estados do formulário de nova categoria
  const [newCategory, setNewCategory] = useState({
    name: '',
    budget: '',
    color: '#2F6F65',
    icon: '💰'
  })

  // Estados para edição de perfil
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [profileData, setProfileData] = useState({
    email: ''
  })
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // Verificar autenticação
  useEffect(() => {
    checkUser()
  }, [])

  // Carregar dados quando usuário estiver autenticado
  useEffect(() => {
    if (user) {
      loadUserProfile()
      refreshDashboard()
    }
  }, [user])

  // Configurar Supabase Realtime
  useEffect(() => {
    if (!user) return

    // Subscription para categories
    const categoriesChannel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Category change detected:', payload)
          refreshDashboard()
        }
      )
      .subscribe()

    // Subscription para transactions
    const transactionsChannel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Transaction change detected:', payload)
          refreshDashboard()
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      supabase.removeChannel(categoriesChannel)
      supabase.removeChannel(transactionsChannel)
    }
  }, [user])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      setLoading(false)
    } catch (error) {
      console.error('Erro ao verificar usuário:', error)
      router.push('/login')
    }
  }

  const loadUserProfile = async () => {
    if (!user) return
    
    setUserProfile({
      email: user.email || null
    })
  }

  // ✨ FUNÇÃO CENTRAL DE ATUALIZAÇÃO DO DASHBOARD
  const refreshDashboard = async () => {
    if (!user) return

    try {
      // 1. Buscar todas as categorias do usuário
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (categoriesError) throw categoriesError

      // 2. Buscar todas as transações do usuário (pelo menos do mês atual)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (transactionsError) throw transactionsError

      // 3. Mapear categorias
      const mappedCategories = (categoriesData || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        budget: cat.budget || 0,
        spent: 0, // Será calculado a seguir
        color: cat.color || '#2F6F65',
        icon: cat.icon || '💰'
      }))

      // 4. Mapear transações
      const mappedTransactions = (transactionsData || []).map((t: any) => {
        const category = mappedCategories.find(cat => cat.id === t.category_id)
        
        return {
          id: t.id,
          type: t.type,
          amount: parseFloat(t.amount),
          category: category?.name || 'Sem categoria',
          category_id: t.category_id,
          description: t.description,
          date: t.date,
          status: 'completed',
          location: t.location || 'Não informado',
          time: t.created_at ? new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--',
          method: t.method || 'Não informado'
        }
      })

      // 5. Recalcular gastos por categoria
      const categoriesWithSpent = mappedCategories.map(category => {
        const totalSpent = mappedTransactions
          .filter(t => t.type === 'expense' && t.category_id === category.id)
          .reduce((sum, t) => sum + t.amount, 0)
        
        return {
          ...category,
          spent: totalSpent
        }
      })

      // 6. Atualizar estados
      setCategories(categoriesWithSpent)
      setTransactions(mappedTransactions)

      console.log('Dashboard atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao atualizar dashboard:', error)
      toast.error('Erro ao atualizar dados do dashboard')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const resetTransactionForm = () => {
    setNewTransaction({
      type: '',
      amount: '',
      category_id: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      location: '',
      method: ''
    })
  }

  const resetCategoryForm = () => {
    setNewCategory({
      name: '',
      budget: '',
      color: '#2F6F65',
      icon: '💰'
    })
  }

  // CRUD TRANSAÇÕES
  const handleAddTransaction = async () => {
    // Validação: categoria só é obrigatória para despesas
    const isCategoryRequired = newTransaction.type === 'expense'
    const isCategoryValid = !isCategoryRequired || newTransaction.category_id
    
    if (!newTransaction.type || !newTransaction.amount || !isCategoryValid || !newTransaction.description) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const transactionData: any = {
        user_id: user.id,
        type: newTransaction.type,
        amount: parseFloat(newTransaction.amount.replace(',', '.')),
        description: newTransaction.description,
        date: newTransaction.date,
        location: newTransaction.location || 'Não informado',
        method: newTransaction.method || 'Não informado'
      }

      // Adicionar category_id apenas se for despesa
      if (newTransaction.type === 'expense' && newTransaction.category_id) {
        transactionData.category_id = parseInt(newTransaction.category_id)
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()

      if (error) throw error

      toast.success('Transação adicionada com sucesso!')
      setIsAddTransactionOpen(false)
      resetTransactionForm()
      
      // ✨ Atualizar dashboard
      await refreshDashboard()
    } catch (error) {
      console.error('Erro ao adicionar transação:', error)
      toast.error('Erro ao adicionar transação')
    }
  }

  const handleOpenEditTransaction = (transaction: Transaction) => {
    setTransactionToEdit(transaction)
    setNewTransaction({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category_id: transaction.category_id?.toString() || '',
      description: transaction.description,
      date: transaction.date,
      location: transaction.location,
      method: transaction.method
    })
    setIsTransactionDetailOpen(false)
    setIsEditTransactionOpen(true)
  }

  const handleEditTransaction = async () => {
    // Validação: categoria só é obrigatória para despesas
    const isCategoryRequired = newTransaction.type === 'expense'
    const isCategoryValid = !isCategoryRequired || newTransaction.category_id
    
    if (!transactionToEdit || !newTransaction.type || !newTransaction.amount || !isCategoryValid || !newTransaction.description) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const updateData: any = {
        type: newTransaction.type,
        amount: parseFloat(newTransaction.amount.replace(',', '.')),
        description: newTransaction.description,
        date: newTransaction.date,
        location: newTransaction.location || 'Não informado',
        method: newTransaction.method || 'Não informado'
      }

      // Adicionar category_id apenas se for despesa
      if (newTransaction.type === 'expense' && newTransaction.category_id) {
        updateData.category_id = parseInt(newTransaction.category_id)
      } else {
        updateData.category_id = null
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionToEdit.id)
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Transação atualizada com sucesso!')
      setIsEditTransactionOpen(false)
      setTransactionToEdit(null)
      resetTransactionForm()
      
      // ✨ Atualizar dashboard
      await refreshDashboard()
    } catch (error) {
      console.error('Erro ao editar transação:', error)
      toast.error('Erro ao editar transação')
    }
  }

  const handleOpenDeleteTransaction = (transaction: Transaction) => {
    setTransactionToDelete(transaction)
    setIsTransactionDetailOpen(false)
    setIsDeleteTransactionOpen(true)
  }

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionToDelete.id)
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Transação excluída com sucesso!')
      setIsDeleteTransactionOpen(false)
      setTransactionToDelete(null)
      
      // ✨ Atualizar dashboard
      await refreshDashboard()
    } catch (error) {
      console.error('Erro ao excluir transação:', error)
      toast.error('Erro ao excluir transação')
    }
  }

  // CRUD CATEGORIAS
  const handleAddCategory = async () => {
    if (!newCategory.name || !newCategory.budget) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: user.id,
          name: newCategory.name,
          budget: parseFloat(newCategory.budget.replace(',', '.')),
          color: newCategory.color,
          icon: newCategory.icon
        }])
        .select()

      if (error) throw error

      toast.success('Categoria criada com sucesso!')
      setIsAddCategoryOpen(false)
      resetCategoryForm()
      
      // ✨ Atualizar dashboard
      await refreshDashboard()
    } catch (error) {
      console.error('Erro ao criar categoria:', error)
      toast.error('Erro ao criar categoria')
    }
  }

  const handleOpenEditCategory = (category: Category) => {
    setCategoryToEdit(category)
    setNewCategory({
      name: category.name,
      budget: category.budget.toString(),
      color: category.color,
      icon: category.icon
    })
    setIsEditCategoryOpen(true)
  }

  const handleEditCategory = async () => {
    if (!categoryToEdit || !newCategory.name || !newCategory.budget) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: newCategory.name,
          budget: parseFloat(newCategory.budget.replace(',', '.')),
          color: newCategory.color,
          icon: newCategory.icon
        })
        .eq('id', categoryToEdit.id)
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Categoria atualizada com sucesso!')
      setIsEditCategoryOpen(false)
      setCategoryToEdit(null)
      resetCategoryForm()
      
      // ✨ Atualizar dashboard
      await refreshDashboard()
    } catch (error) {
      console.error('Erro ao editar categoria:', error)
      toast.error('Erro ao editar categoria')
    }
  }

  const handleOpenDeleteCategory = (category: Category) => {
    setCategoryToDelete(category)
    setIsDeleteCategoryOpen(true)
  }

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return

    try {
      // Verificar se existem transações usando esta categoria
      const { data: transactionsWithCategory, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('category_id', categoryToDelete.id)
        .eq('user_id', user.id)
        .limit(1)

      if (checkError) throw checkError

      if (transactionsWithCategory && transactionsWithCategory.length > 0) {
        toast.error('Não é possível excluir esta categoria porque ela tem transações vinculadas')
        setIsDeleteCategoryOpen(false)
        setCategoryToDelete(null)
        return
      }

      // Deletar categoria
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryToDelete.id)
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Categoria excluída com sucesso!')
      setIsDeleteCategoryOpen(false)
      setCategoryToDelete(null)
      
      // ✨ Atualizar dashboard
      await refreshDashboard()
    } catch (error) {
      console.error('Erro ao excluir categoria:', error)
      toast.error('Erro ao excluir categoria')
    }
  }

  const handleExportTransactions = () => {
    const transactionsToExport = getFilteredTransactions()
    
    if (transactionsToExport.length === 0) {
      toast.error('Não há transações para exportar')
      return
    }

    const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Local', 'Método', 'Horário']
    const rows = transactionsToExport.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.category,
      t.description,
      `R$ ${t.amount.toFixed(2).replace('.', ',')}`,
      t.location,
      t.method,
      t.time
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `\"${cell}\"`).join(','))
    ].join('\\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `extrato_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Extrato exportado! ${transactionsToExport.length} transações`)
  }

  const getFilteredTransactions = () => {
    const now = new Date()
    let startDate = new Date()

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case '7-days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30-days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90-days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'custom':
        if (customDateFrom && customDateTo) {
          startDate = new Date(customDateFrom)
          const endDate = new Date(customDateTo)
          return transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date)
            const matchesDate = transactionDate >= startDate && transactionDate <= endDate
            const matchesType = transactionTypeFilter === 'all' || transaction.type === transactionTypeFilter
            const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
            const matchesSearch = searchTerm === '' || 
              transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
              transaction.category.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesDate && matchesType && matchesCategory && matchesSearch
          })
        }
        return transactions.filter(transaction => {
          const matchesType = transactionTypeFilter === 'all' || transaction.type === transactionTypeFilter
          const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
          const matchesSearch = searchTerm === '' || 
            transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            transaction.category.toLowerCase().includes(searchTerm.toLowerCase())
          return matchesType && matchesCategory && matchesSearch
        })
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date)
      const matchesDate = transactionDate >= startDate
      const matchesType = transactionTypeFilter === 'all' || transaction.type === transactionTypeFilter
      const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
      const matchesSearch = searchTerm === '' || 
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesDate && matchesType && matchesCategory && matchesSearch
    })
  }

  // CÁLCULOS - Baseados apenas em transações do usuário
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpenses

  const filteredTransactions = getFilteredTransactions()
  const filteredIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const filteredExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const filteredBalance = filteredIncome - filteredExpenses

  const pieChartData = categories
    .filter(category => category.spent > 0)
    .map(category => ({
      name: category.name,
      value: category.spent,
      color: category.color
    }))
    .sort((a, b) => b.value - a.value) // Ordenar por valor (maior primeiro)

  // Dados mensais calculados a partir das transações reais do usuário
  const getMonthlyData = () => {
    const monthlyStats: { [key: string]: { income: number; expenses: number } } = {}
    const now = new Date()
    
    // Últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toLocaleDateString('pt-BR', { month: 'short' })
      monthlyStats[monthKey] = { income: 0, expenses: 0 }
    }

    transactions.forEach(t => {
      const transactionDate = new Date(t.date)
      const monthKey = transactionDate.toLocaleDateString('pt-BR', { month: 'short' })
      
      if (monthlyStats[monthKey]) {
        if (t.type === 'income') {
          monthlyStats[monthKey].income += t.amount
        } else {
          monthlyStats[monthKey].expenses += t.amount
        }
      }
    })

    return Object.entries(monthlyStats).map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses
    }))
  }

  const monthlyData = getMonthlyData()

  const renderTooltip = (props: any) => {
    if (props.active && props.payload && props.payload.length) {
      const data = props.payload[0]
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-[#1F2933]">{data.name}</p>
          <p className="text-sm text-[#8A8F98]">
            R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#8A8F98]">
            {((data.value / pieChartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}% do total
          </p>
        </div>
      )
    }
    return null
  }

  const openTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsTransactionDetailOpen(true)
  }

  const getCategoryIcon = (categoryId: number) => {
    const categoryData = categories.find(cat => cat.id === categoryId)
    return categoryData?.icon || '💰'
  }

  const availableIcons = [
    '💰', '🍽️', '🚗', '🏠', '🎬', '⚕️', '💼', '💻', '📈', '🛒', 
    '✈️', '🎓', '👕', '📱', '🏋️', '🎵', '📚', '🎮', '🍕', '☕'
  ]

  // Funções de edição de perfil
  const handleOpenEditProfile = () => {
    setProfileData({
      email: userProfile.email || ''
    })
    setIsEditProfileOpen(true)
  }

  const handleUpdateProfile = async () => {
    if (!profileData.email.trim()) {
      toast.error('O email não pode estar vazio')
      return
    }

    setIsUpdatingProfile(true)
    try {
      const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser()
      
      if (getUserError || !currentUser) {
        console.error('Erro ao obter usuário:', getUserError)
        throw new Error('Não foi possível obter dados do usuário')
      }

      if (profileData.email !== currentUser.email) {
        const { error: authEmailError } = await supabase.auth.updateUser({
          email: profileData.email
        })

        if (authEmailError) {
          console.error('Erro ao atualizar email no Auth:', authEmailError)
          toast.error('Email pode exigir confirmação.')
        } else {
          toast.success('Email atualizado com sucesso!')
        }
      } else {
        toast.success('Nenhuma alteração foi feita.')
      }

      setIsEditProfileOpen(false)
      await loadUserProfile()
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setUser(session.user)
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error)
      toast.error(error.message || 'Erro ao atualizar informações')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Preencha todos os campos')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    setIsUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      toast.success('Senha alterada com sucesso!')
      setIsChangePasswordOpen(false)
      setPasswordData({
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error)
      toast.error(error.message || 'Erro ao alterar senha')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#FFFFFF]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2F6F65]" />
          <p className="text-[#8A8F98]">Carregando...</p>
        </div>
      </div>
    )
  }

  const renderDashboard = () => {
    // Preparar dados para "Gastos por Categoria" (top 3 maiores)
    const displayedCategorySpending = showAllCategorySpending 
      ? pieChartData 
      : pieChartData.slice(0, 3)

    // Preparar dados para "Controle de Orçamento" (top 3 maiores por spent)
    const budgetCategories = categories
      .filter(cat => cat.budget > 0)
      .sort((a, b) => b.spent - a.spent)
    
    const displayedBudgetCategories = showAllBudgetControl
      ? budgetCategories
      : budgetCategories.slice(0, 3)

    return (
      <div className="space-y-6">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Saldo de Conta</CardTitle>
              <DollarSign className="h-4 w-4 text-[#6B7280]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1F2933]">
                R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-[#8A8F98] mt-1">
                Valor disponível no momento.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#6B7280]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1F2933]">
                R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-[#8A8F98] mt-1">
                Valor total de dinheiro que entrou
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-[#6B7280]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1F2933]">
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-[#8A8F98] mt-1">
                Valor total do dinheiro que saiu
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Taxa de Economia</CardTitle>
              <Target className="h-4 w-4 text-[#6B7280]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1F2933]">
                {totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0.0'}%
              </div>
              <p className="text-xs text-[#8A8F98] mt-1">
                Quanto você conseguiu poupar neste mês.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-[#1F2933]">Fluxo de Caixa</CardTitle>
              <p className="text-sm text-[#8A8F98] mt-1">
                Compare suas receitas e despesas ao longo do tempo.
              </p>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 && monthlyData.some(m => m.income > 0 || m.expenses > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="month" stroke="#8A8F98" />
                      <YAxis stroke="#8A8F98" />
                      <Bar dataKey="income" fill="#2F6F65" name="Receitas" />
                      <Bar dataKey="expenses" fill="#6BC2A1" name="Despesas" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#2F6F65] rounded"></div>
                      <span className="text-[#8A8F98]">Receitas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#6BC2A1] rounded"></div>
                      <span className="text-[#8A8F98]">Despesas</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-[#8A8F98]">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma transação registrada ainda</p>
                    <p className="text-sm">Adicione transações para ver o gráfico</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-[#1F2933] flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Gastos por Categoria
              </CardTitle>
              <p className="text-sm text-[#8A8F98] mt-1">
                Identifique onde seu dinheiro está sendo usado.
              </p>
            </CardHeader>
            <CardContent>
              {pieChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={renderTooltip} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  
                  <div className="mt-4 space-y-2">
                    {displayedCategorySpending.map((category, index) => {
                      const percentage = ((category.value / pieChartData.reduce((sum, item) => sum + item.value, 0)) * 100)
                      return (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="text-[#1F2933]">{category.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-[#1F2933]">
                              R$ {category.value.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[#8A8F98] ml-2 text-xs">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {pieChartData.length > 3 && (
                      <button
                        onClick={() => setShowAllCategorySpending(!showAllCategorySpending)}
                        className="w-full text-center text-sm text-[#2F6F65] hover:text-[#6BC2A1] py-2 flex items-center justify-center gap-1 transition-colors"
                      >
                        {showAllCategorySpending ? (
                          <>
                            Ver menos <ChevronUp className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            Ver mais <ChevronDown className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-[#8A8F98]">
                  <div className="text-center">
                    <PieChart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma despesa registrada ainda</p>
                    <p className="text-sm">Adicione transações para ver o gráfico</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orçamentos */}
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-[#1F2933]">Controle de Orçamento</CardTitle>
          </CardHeader>
          <CardContent>
            {budgetCategories.length > 0 ? (
              <div className="space-y-4">
                {displayedBudgetCategories.map((category) => {
                  const percentage = (category.spent / category.budget) * 100
                  const isOverBudget = percentage > 100
                  
                  // Determinar status baseado no percentual
                  let statusText = 'Dentro do esperado'
                  
                  if (percentage >= 100) {
                    statusText = 'Limite excedido'
                  } else if (percentage >= 75) {
                    statusText = 'Cuidado — quase no limite'
                  } else if (percentage >= 50) {
                    statusText = 'Atenção aos próximos gastos'
                  }
                  
                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-[#1F2933] flex items-center gap-2">
                            {category.icon} {category.name}
                          </span>
                          <span className="text-xs text-[#8A8F98]">
                            {percentage.toFixed(1)}% usado
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm text-[#1F2933]">
                            R$ {category.spent.toLocaleString('pt-BR')} / R$ {category.budget.toLocaleString('pt-BR')}
                          </span>
                          <div className="text-xs text-[#8A8F98]">
                            <span>{statusText}</span>
                          </div>
                        </div>
                      </div>
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className="h-2"
                      />
                    </div>
                  )
                })}
                
                {budgetCategories.length > 3 && (
                  <button
                    onClick={() => setShowAllBudgetControl(!showAllBudgetControl)}
                    className="w-full text-center text-sm text-[#2F6F65] hover:text-[#6BC2A1] py-2 flex items-center justify-center gap-1 transition-colors"
                  >
                    {showAllBudgetControl ? (
                      <>
                        Ver menos <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Ver mais <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-[#8A8F98]">
                <Target className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum orçamento configurado</p>
                <p className="text-sm">Crie categorias com orçamentos para acompanhar seus gastos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderTransactions = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-[#1F2933]">Extrato Completo</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]"
            onClick={handleExportTransactions}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2F6F65] text-white hover:bg-[#6BC2A1]">
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Adicionar Transação
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type" className="text-sm font-medium">Tipo *</Label>
                    <Select value={newTransaction.type} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">💰 Receita</SelectItem>
                        <SelectItem value="expense">💸 Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount" className="text-sm font-medium">Valor *</Label>
                    <Input 
                      id="amount" 
                      placeholder="0,00" 
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>
                
                {newTransaction.type === 'expense' && (
                  <div>
                    <Label htmlFor="category" className="text-sm font-medium">Categoria *</Label>
                    <Select value={newTransaction.category_id} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, category_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length > 0 ? (
                          categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.icon} {category.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            Nenhuma categoria disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {categories.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Crie uma categoria primeiro na aba "Categorias"
                      </p>
                    )}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Descrição *</Label>
                  <Input 
                    id="description" 
                    placeholder="Ex: Supermercado, Combustível, Salário..." 
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="date" className="text-sm font-medium">Data</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="location" className="text-sm font-medium">Local</Label>
                  <Input 
                    id="location" 
                    placeholder="Ex: Shopping Center, Posto Shell..." 
                    value={newTransaction.location}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="method" className="text-sm font-medium">Método de Pagamento</Label>
                  <Select value={newTransaction.method} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, method: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="TED">TED</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Débito Automático">Débito Automático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddTransactionOpen(false)
                      resetTransactionForm()
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddTransaction}
                    className="flex-1 bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                    disabled={
                      !newTransaction.type || 
                      !newTransaction.amount || 
                      !newTransaction.description ||
                      (newTransaction.type === 'expense' && !newTransaction.category_id)
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
                
                <p className="text-xs text-[#8A8F98] text-center">
                  * Campos obrigatórios
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="text-[#1F2933] flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8A8F98]" />
              <Input
                placeholder="Pesquisar por descrição ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1F2933] mb-2 block">Período</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <Button
                    variant={dateFilter === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter('today')}
                    className={dateFilter === 'today' ? 'bg-[#2F6F65] text-white hover:bg-[#6BC2A1]' : 'border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]'}
                  >
                    Hoje
                  </Button>
                  <Button
                    variant={dateFilter === '7-days' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter('7-days')}
                    className={dateFilter === '7-days' ? 'bg-[#2F6F65] text-white hover:bg-[#6BC2A1]' : 'border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]'}
                  >
                    7 dias
                  </Button>
                  <Button
                    variant={dateFilter === '30-days' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter('30-days')}
                    className={dateFilter === '30-days' ? 'bg-[#2F6F65] text-white hover:bg-[#6BC2A1]' : 'border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]'}
                  >
                    30 dias
                  </Button>
                  <Button
                    variant={dateFilter === '90-days' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter('90-days')}
                    className={dateFilter === '90-days' ? 'bg-[#2F6F65] text-white hover:bg-[#6BC2A1]' : 'border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]'}
                  >
                    90 dias
                  </Button>
                  <Button
                    variant={dateFilter === 'this-year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter('this-year')}
                    className={dateFilter === 'this-year' ? 'bg-[#2F6F65] text-white hover:bg-[#6BC2A1]' : 'border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]'}
                  >
                    Este ano
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={dateFilter === 'custom' ? 'default' : 'outline'}
                        size="sm"
                        className={dateFilter === 'custom' ? 'bg-[#2F6F65] text-white hover:bg-[#6BC2A1]' : 'border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]'}
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Personalizado
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="date-from">Data inicial</Label>
                          <Input
                            id="date-from"
                            type="date"
                            value={customDateFrom}
                            onChange={(e) => setCustomDateFrom(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date-to">Data final</Label>
                          <Input
                            id="date-to"
                            type="date"
                            value={customDateTo}
                            onChange={(e) => setCustomDateTo(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => setDateFilter('custom')}
                          className="w-full bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                          disabled={!customDateFrom || !customDateTo}
                        >
                          Aplicar Período
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-32">
                  <Label className="text-sm font-medium text-[#1F2933] mb-2 block">Tipo</Label>
                  <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="income">Receitas</SelectItem>
                      <SelectItem value="expense">Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label className="text-sm font-medium text-[#1F2933] mb-2 block">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#8A8F98]">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Período:</span>
                  <Badge variant="outline" className="border-gray-300">
                    {dateFilter === 'today' && 'Hoje'}
                    {dateFilter === '7-days' && 'Últimos 7 dias'}
                    {dateFilter === '30-days' && 'Últimos 30 dias'}
                    {dateFilter === '90-days' && 'Últimos 90 dias'}
                    {dateFilter === 'this-year' && 'Este ano'}
                    {dateFilter === 'custom' && customDateFrom && customDateTo && 
                      `${new Date(customDateFrom).toLocaleDateString('pt-BR')} - ${new Date(customDateTo).toLocaleDateString('pt-BR')}`}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Transações:</span>
                  <Badge className="bg-[#2F6F65] text-white">
                    {filteredTransactions.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Receitas:</span>
                  <Badge variant="outline" className="border-green-500 text-green-700">
                    +R$ {filteredIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Despesas:</span>
                  <Badge variant="outline" className="border-red-500 text-red-700">
                    -R$ {filteredExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Saldo:</span>
                  <Badge 
                    variant="outline" 
                    className={`border-2 ${filteredBalance >= 0 ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}`}
                  >
                    {filteredBalance >= 0 ? '+' : ''}R$ {filteredBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Transações */}
      <Card className="border-gray-200 bg-white">
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-[#8A8F98]">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Nenhuma transação encontrada</p>
              <p className="text-sm">
                {transactions.length === 0 
                  ? 'Comece adicionando sua primeira transação' 
                  : 'Tente ajustar os filtros ou adicionar uma nova transação'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                     onClick={() => openTransactionDetail(transaction)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full text-lg ${
                        transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {transaction.category_id ? getCategoryIcon(transaction.category_id) : '💰'}
                      </div>
                      <div>
                        <p className="font-medium text-[#1F2933]">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-sm text-[#8A8F98]">
                          <span>{transaction.category}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {transaction.location}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {transaction.time}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center justify-end gap-2 text-sm text-[#8A8F98]">
                        <span>{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                        <Eye className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes da Transação */}
      <Dialog open={isTransactionDetailOpen} onOpenChange={setIsTransactionDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedTransaction && selectedTransaction.category_id ? getCategoryIcon(selectedTransaction.category_id) : '💰'}</span>
              Detalhes da Transação
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className={`text-3xl font-bold ${
                  selectedTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {selectedTransaction.type === 'income' ? '+' : '-'}R$ {selectedTransaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-lg font-medium text-[#1F2933] mt-2">{selectedTransaction.description}</p>
              </div>
              
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-[#8A8F98]">Categoria:</span>
                  <span className="font-medium text-[#1F2933]">{selectedTransaction.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8F98]">Data:</span>
                  <span className="font-medium text-[#1F2933]">
                    {new Date(selectedTransaction.date).toLocaleDateString('pt-BR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8F98]">Horário:</span>
                  <span className="font-medium text-[#1F2933]">{selectedTransaction.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8F98]">Local:</span>
                  <span className="font-medium text-[#1F2933]">{selectedTransaction.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8F98]">Método:</span>
                  <span className="font-medium text-[#1F2933]">{selectedTransaction.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8F98]">Status:</span>
                  <Badge className="bg-green-100 text-green-800">
                    ✓ Concluída
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleOpenEditTransaction(selectedTransaction)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:bg-red-50"
                  onClick={() => handleOpenDeleteTransaction(selectedTransaction)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Transação */}
      <Dialog open={isEditTransactionOpen} onOpenChange={setIsEditTransactionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type" className="text-sm font-medium">Tipo *</Label>
                <Select value={newTransaction.type} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">💰 Receita</SelectItem>
                    <SelectItem value="expense">💸 Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-amount" className="text-sm font-medium">Valor *</Label>
                <Input 
                  id="edit-amount" 
                  placeholder="0,00" 
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>
            
            {newTransaction.type === 'expense' && (
              <div>
                <Label htmlFor="edit-category" className="text-sm font-medium">Categoria *</Label>
                <Select value={newTransaction.category_id} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, category_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label htmlFor="edit-description" className="text-sm font-medium">Descrição *</Label>
              <Input 
                id="edit-description" 
                placeholder="Ex: Supermercado, Combustível, Salário..." 
                value={newTransaction.description}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-date" className="text-sm font-medium">Data</Label>
              <Input 
                id="edit-date" 
                type="date" 
                value={newTransaction.date}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-location" className="text-sm font-medium">Local</Label>
              <Input 
                id="edit-location" 
                placeholder="Ex: Shopping Center, Posto Shell..." 
                value={newTransaction.location}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-method" className="text-sm font-medium">Método de Pagamento</Label>
              <Select value={newTransaction.method} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, method: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="TED">TED</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Débito Automático">Débito Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditTransactionOpen(false)
                  setTransactionToEdit(null)
                  resetTransactionForm()
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleEditTransaction}
                className="flex-1 bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                disabled={
                  !newTransaction.type || 
                  !newTransaction.amount || 
                  !newTransaction.description ||
                  (newTransaction.type === 'expense' && !newTransaction.category_id)
                }
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão de Transação */}
      <AlertDialog open={isDeleteTransactionOpen} onOpenChange={setIsDeleteTransactionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a transação "{transactionToDelete?.description}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteTransactionOpen(false)
              setTransactionToDelete(null)
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTransaction}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-[#1F2933]">Gerenciar Categorias</h2>
        <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2F6F65] text-white hover:bg-[#6BC2A1]">
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category-name" className="text-sm font-medium">Nome da Categoria *</Label>
                <Input 
                  id="category-name" 
                  placeholder="Ex: Alimentação, Transporte..." 
                  value={newCategory.name}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="category-budget" className="text-sm font-medium">Orçamento Mensal *</Label>
                <Input 
                  id="category-budget" 
                  placeholder="0,00" 
                  value={newCategory.budget}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, budget: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="category-color" className="text-sm font-medium">Cor</Label>
                <div className="flex gap-2 items-center">
                  <Input 
                    id="category-color" 
                    type="color" 
                    value={newCategory.color}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                    className="w-20 h-10"
                  />
                  <span className="text-sm text-[#8A8F98]">{newCategory.color}</span>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Ícone</Label>
                <div className="grid grid-cols-10 gap-2 mt-2">
                  {availableIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewCategory(prev => ({ ...prev, icon }))}
                      className={`text-2xl p-2 rounded hover:bg-[#F7F8FA] transition-colors ${
                        newCategory.icon === icon ? 'bg-[#F7F8FA] ring-2 ring-[#2F6F65]' : ''
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddCategoryOpen(false)
                    resetCategoryForm()
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddCategory}
                  className="flex-1 bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                  disabled={!newCategory.name || !newCategory.budget}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Categoria
                </Button>
              </div>
              
              <p className="text-xs text-[#8A8F98] text-center">
                * Campos obrigatórios
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Categorias */}
      {categories.length === 0 ? (
        <Card className="border-gray-200 bg-white">
          <CardContent className="p-8 text-center text-[#8A8F98]">
            <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Nenhuma categoria criada ainda</p>
            <p className="text-sm">Crie sua primeira categoria para começar a organizar suas finanças</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const percentage = category.budget > 0 ? (category.spent / category.budget) * 100 : 0
            const isOverBudget = percentage > 100
            
            return (
              <Card key={category.id} className="border-gray-200 bg-white hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="text-2xl p-2 rounded-lg"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        {category.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base text-[#1F2933]">{category.name}</CardTitle>
                        <p className="text-xs text-[#8A8F98] mt-1">
                          {percentage.toFixed(1)}% usado
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditCategory(category)}
                        className="h-7 w-7"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDeleteCategory(category)}
                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8A8F98]">Gasto:</span>
                      <span className="font-medium text-[#1F2933]">
                        R$ {category.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8A8F98]">Orçamento:</span>
                      <span className="font-medium text-[#1F2933]">
                        R$ {category.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8A8F98]">Disponível:</span>
                      <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                        R$ {Math.abs(category.budget - category.spent).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className="h-2"
                      style={{ 
                        backgroundColor: `${category.color}20`,
                      }}
                    />
                    {isOverBudget && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        <AlertCircle className="h-3 w-3" />
                        <span>Orçamento excedido em R$ {(category.spent - category.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Edição de Categoria */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-category-name" className="text-sm font-medium">Nome da Categoria *</Label>
              <Input 
                id="edit-category-name" 
                placeholder="Ex: Alimentação, Transporte..." 
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-category-budget" className="text-sm font-medium">Orçamento Mensal *</Label>
              <Input 
                id="edit-category-budget" 
                placeholder="0,00" 
                value={newCategory.budget}
                onChange={(e) => setNewCategory(prev => ({ ...prev, budget: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-category-color" className="text-sm font-medium">Cor</Label>
              <div className="flex gap-2 items-center">
                <Input 
                  id="edit-category-color" 
                  type="color" 
                  value={newCategory.color}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                  className="w-20 h-10"
                />
                <span className="text-sm text-[#8A8F98]">{newCategory.color}</span>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Ícone</Label>
              <div className="grid grid-cols-10 gap-2 mt-2">
                {availableIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewCategory(prev => ({ ...prev, icon }))}
                    className={`text-2xl p-2 rounded hover:bg-[#F7F8FA] transition-colors ${
                      newCategory.icon === icon ? 'bg-[#F7F8FA] ring-2 ring-[#2F6F65]' : ''
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditCategoryOpen(false)
                  setCategoryToEdit(null)
                  resetCategoryForm()
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleEditCategory}
                className="flex-1 bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                disabled={!newCategory.name || !newCategory.budget}
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão de Categoria */}
      <AlertDialog open={isDeleteCategoryOpen} onOpenChange={setIsDeleteCategoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{categoryToDelete?.name}"? 
              Esta ação não pode ser desfeita e só é possível se não houver transações vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteCategoryOpen(false)
              setCategoryToDelete(null)
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  const renderSettings = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#1F2933]">Configurações</h2>

      {/* Informações da Conta */}
      <Card className="border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="text-[#1F2933]">Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#8A8F98]">Email:</span>
              <span className="font-medium text-[#1F2933]">{userProfile.email || 'Não informado'}</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              variant="outline"
              className="flex-1 border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]"
              onClick={handleOpenEditProfile}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar informações
            </Button>
            <Button 
              variant="outline"
              className="flex-1 border-gray-300 text-[#1F2933] hover:bg-[#F7F8FA]"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Edição de Perfil */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Informações</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="profile-email" className="text-sm font-medium">Email *</Label>
              <Input 
                id="profile-email" 
                type="email"
                placeholder="seu@email.com"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditProfileOpen(false)
                  setProfileData({ email: '' })
                }}
                className="flex-1"
                disabled={isUpdatingProfile}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateProfile}
                className="flex-1 bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                disabled={isUpdatingProfile || !profileData.email.trim()}
              >
                {isUpdatingProfile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Alteração de Senha */}
      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="text-sm font-medium">Nova Senha *</Label>
              <Input 
                id="new-password" 
                type="password"
                placeholder="Mínimo 6 caracteres" 
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="confirm-password" className="text-sm font-medium">Confirmar Nova Senha *</Label>
              <Input 
                id="confirm-password" 
                type="password"
                placeholder="Digite a senha novamente" 
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsChangePasswordOpen(false)
                  setPasswordData({
                    newPassword: '',
                    confirmPassword: ''
                  })
                }}
                className="flex-1"
                disabled={isUpdatingPassword}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleChangePassword}
                className="flex-1 bg-[#2F6F65] text-white hover:bg-[#6BC2A1]"
                disabled={isUpdatingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  'Alterar Senha'
                )}
              </Button>
            </div>
            
            <p className="text-xs text-[#8A8F98] text-center">
              * Campos obrigatórios
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#2F6F65] rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-[#1F2933]">FinanceControl</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleLogout}
                className="text-[#8A8F98] hover:text-[#1F2933]"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-[#F7F8FA]">
              <TabsTrigger 
                value="dashboard" 
                className="flex items-center space-x-2 data-[state=active]:bg-[#2F6F65] data-[state=active]:text-white"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="transactions" 
                className="flex items-center space-x-2 data-[state=active]:bg-[#2F6F65] data-[state=active]:text-white"
              >
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Extrato</span>
              </TabsTrigger>
              <TabsTrigger 
                value="categories" 
                className="flex items-center space-x-2 data-[state=active]:bg-[#2F6F65] data-[state=active]:text-white"
              >
                <PieChart className="h-4 w-4" />
                <span className="hidden sm:inline">Categorias</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex items-center space-x-2 data-[state=active]:bg-[#2F6F65] data-[state=active]:text-white"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Configurações</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard">
            {renderDashboard()}
          </TabsContent>
          <TabsContent value="transactions">
            {renderTransactions()}
          </TabsContent>
          <TabsContent value="categories">
            {renderCategories()}
          </TabsContent>
          <TabsContent value="settings">
            {renderSettings()}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
