import React, { useEffect, useState } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import Card from '../components/Card'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const COLOR = '#10B981'

export default function Money() {
  const { docs: txns, loading: lTxn, fetchDocs: fetchTxns, addDocument: addTxn, deleteDocument: deleteTxn } = useFirestore('transactions')
  const { docs: savingsGoals, loading: lSav, fetchDocs: fetchSav, addDocument: addSav, updateDocument: updateSav, deleteDocument: deleteSav } = useFirestore('savingsGoals')
  const [showModal, setShowModal] = useState(false)
  const [showSavModal, setShowSavModal] = useState(false)
  const [txnForm, setTxnForm] = useState({ amount: '', type: 'income', category: '', note: '', date: new Date().toISOString().slice(0, 10) })
  const [savForm, setSavForm] = useState({ name: '', target: '', current: '' })

  useEffect(() => { fetchTxns(); fetchSav() }, [fetchTxns, fetchSav])

  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const balance = income - expenses

  async function handleAddTxn(e) {
    e.preventDefault()
    await addTxn({ ...txnForm, amount: parseFloat(txnForm.amount) })
    setTxnForm({ amount: '', type: 'income', category: '', note: '', date: new Date().toISOString().slice(0, 10) })
    setShowModal(false)
  }

  async function handleAddSav(e) {
    e.preventDefault()
    await addSav({ name: savForm.name, target: parseFloat(savForm.target), current: parseFloat(savForm.current) || 0 })
    setSavForm({ name: '', target: '', current: '' })
    setShowSavModal(false)
  }

  async function addToSavings(goal, amount) {
    const newCurrent = Math.min((goal.current || 0) + amount, goal.target || 0)
    await updateSav(goal.id, { current: newCurrent })
  }

  const loading = lTxn || lSav
  const recentTxns = [...txns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10)

  return (
    <div className="page-enter min-h-screen p-4 pt-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em]" style={{ color: COLOR }}>Money</h1>
          <p className="text-white/40 text-sm mt-1">Track income & expenses</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="btn-press w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl"
          style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}60` }}>+</button>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner color={COLOR} size={32} /></div>}

      {/* Balance card */}
      <Card accentColor={COLOR} className="mb-4 py-6 text-center">
        <div className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-1">Balance</div>
        <div className="text-4xl font-black" style={{ color: balance >= 0 ? COLOR : '#EF4444' }}>
          {balance >= 0 ? '+' : ''}{balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </div>
        <div className="flex justify-center gap-8 mt-4">
          <div className="text-center">
            <div className="text-sm font-bold text-green-400">{income.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
            <div className="text-xs text-white/30 mt-0.5">Income</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-red-400">-{expenses.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
            <div className="text-xs text-white/30 mt-0.5">Expenses</div>
          </div>
        </div>
      </Card>

      {/* Savings Goals */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Savings Goals</h2>
        <button onClick={() => setShowSavModal(true)} className="btn-press text-xs font-bold py-1 px-3 rounded-full" style={{ color: COLOR, border: `1px solid ${COLOR}40` }}>+ Add</button>
      </div>
      <div className="space-y-3 mb-6">
        {savingsGoals.map(goal => {
          const pct = goal.target ? Math.min(100, Math.round((goal.current || 0) / goal.target * 100)) : 0
          return (
            <Card key={goal.id} accentColor={COLOR} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-sm">{goal.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: COLOR }}>{pct}%</span>
                  <button onClick={() => deleteSav(goal.id)} className="text-white/20 hover:text-red-400 transition-colors">✕</button>
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: COLOR, boxShadow: `0 0 8px ${COLOR}` }} />
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>${(goal.current || 0).toLocaleString()} saved</span>
                <span>${(goal.target || 0).toLocaleString()} goal</span>
              </div>
              <button onClick={() => addToSavings(goal, 10)}
                className="btn-press mt-2 text-xs font-semibold py-1 px-3 rounded-full transition-colors"
                style={{ color: COLOR, border: `1px solid ${COLOR}30` }}>+ $10</button>
            </Card>
          )
        })}
        {!loading && savingsGoals.length === 0 && (
          <div className="text-center py-6 text-white/20 text-sm">No savings goals yet</div>
        )}
      </div>

      {/* Transactions */}
      <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Recent Transactions</h2>
      <div className="space-y-2">
        {recentTxns.map(txn => (
          <Card key={txn.id} className="flex items-center gap-3 py-3 px-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: txn.type === 'income' ? '#10B98120' : '#EF444420' }}>
              {txn.type === 'income' ? '↑' : '↓'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{txn.note || txn.category || 'Transaction'}</div>
              <div className="text-xs text-white/30">{txn.category} · {txn.date}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`font-bold text-sm ${txn.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                {txn.type === 'income' ? '+' : '-'}${parseFloat(txn.amount || 0).toFixed(2)}
              </div>
              <button onClick={() => deleteTxn(txn.id)} className="text-white/15 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          </Card>
        ))}
        {!loading && txns.length === 0 && (
          <div className="text-center py-8 text-white/30">
            <div className="text-4xl mb-2">💰</div>
            <p className="font-semibold text-sm">Log your first transaction</p>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Transaction" accentColor={COLOR}>
        <form onSubmit={handleAddTxn} className="space-y-4">
          <div className="flex gap-2">
            {['income', 'expense'].map(t => (
              <button key={t} type="button" onClick={() => setTxnForm(f => ({...f, type: t}))}
                className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: txnForm.type === t ? (t === 'income' ? '#10B981' : '#EF4444') : 'rgba(255,255,255,0.05)', color: 'white' }}>
                {t === 'income' ? '↑ Income' : '↓ Expense'}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Amount</label>
            <input type="number" step="0.01" min="0" value={txnForm.amount} onChange={e => setTxnForm(f => ({...f, amount: e.target.value}))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#10B981] transition-colors"
              placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Category</label>
            <input type="text" value={txnForm.category} onChange={e => setTxnForm(f => ({...f, category: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#10B981] transition-colors"
              placeholder="Food, Rent, Salary..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Note</label>
            <input type="text" value={txnForm.note} onChange={e => setTxnForm(f => ({...f, note: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#10B981] transition-colors"
              placeholder="Optional note" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Date</label>
            <input type="date" value={txnForm.date} onChange={e => setTxnForm(f => ({...f, date: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#10B981] transition-colors" />
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #059669)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Add Transaction
          </button>
        </form>
      </Modal>

      <Modal isOpen={showSavModal} onClose={() => setShowSavModal(false)} title="New Savings Goal" accentColor={COLOR}>
        <form onSubmit={handleAddSav} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Goal Name</label>
            <input type="text" value={savForm.name} onChange={e => setSavForm(f => ({...f, name: e.target.value}))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#10B981] transition-colors"
              placeholder="Emergency Fund, Vacation..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Target Amount ($)</label>
            <input type="number" min="0" step="0.01" value={savForm.target} onChange={e => setSavForm(f => ({...f, target: e.target.value}))} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#10B981] transition-colors"
              placeholder="5000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">Current Amount ($)</label>
            <input type="number" min="0" step="0.01" value={savForm.current} onChange={e => setSavForm(f => ({...f, current: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:border-[#10B981] transition-colors"
              placeholder="0" />
          </div>
          <button type="submit" className="btn-press w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${COLOR}, #059669)`, boxShadow: `0 0 30px ${COLOR}50` }}>
            Add Savings Goal
          </button>
        </form>
      </Modal>
    </div>
  )
}
