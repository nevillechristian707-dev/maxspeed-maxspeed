import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListPenjualan, 
  useCreatePenjualan, 
  useUpdatePenjualan,
  useDeletePenjualan,
  useListMasterBarang,
  useListMasterBank,
  useListMasterOnlineShop,
  useListCustomer,
  useGetMe
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/layout";
import { DatePicker } from "@/components/ui/date-picker";
import { formatRupiah, formatDate, generateKodeTransaksi, cn, getIndonesianPeriodLabel, formatDateToYYYYMMDD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Trash2, Download, Search, FileText, Check, ChevronsUpDown, Calendar, FileDown, FileBarChart, Pencil, X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formSchema = z.object({
  tanggal: z.string().min(1, "Required"),
  kodeBarang: z.string().min(1, "Required"),
  harga: z.coerce.number().min(1, "Required"),
  qty: z.coerce.number().min(1, "Required"),
  noFaktur: z.string().optional().nullable(),
  paymentMethod: z.enum(["cash", "bank", "online_shop", "kredit"]),
  nilaiCash: z.coerce.number().optional().nullable(),
  namaBank: z.string().optional().nullable(),
  nilaiBank: z.coerce.number().optional().nullable(),
  namaOnlineShop: z.string().optional().nullable(),
  nilaiOnlineShop: z.coerce.number().optional().nullable(),
  namaCustomer: z.string().optional().nullable(),
  nilaiKredit: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

import { useMonthYear } from "@/context/month-year-context";

export default function Penjualan() {
  const { selectedYear, selectedMonth, dateParams } = useMonthYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openBarang, setOpenBarang] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: user } = useGetMe();

  const currentYear = new Date().getFullYear();

  const { data: listData, isLoading } = useListPenjualan(dateParams);
  const { data: barangData } = useListMasterBarang();

  const filteredListData = useMemo(() => {
    if (!listData) return [];
    let filtered = statusFilter === "all" ? listData : listData.filter(item => item.statusCair === statusFilter);
    
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.namaBarang || "").toLowerCase().includes(query) ||
        (item.brand || "").toLowerCase().includes(query) ||
        (item.kodeBarang || "").toLowerCase().includes(query) ||
        (item.noFaktur || "").toLowerCase().includes(query) ||
        (item.kodeTransaksi || "").toLowerCase().includes(query) ||
        (item.namaOnlineShop || "").toLowerCase().includes(query) ||
        (item.namaCustomer || "").toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [listData, statusFilter, searchTerm]);
  
  const filteredBarang = useMemo(() => {
    if (!barangData) return [];
    if (!productSearch) return barangData;
    
    const terms = productSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return barangData.filter(b => {
      const value = `${b.kodeBarang} ${b.namaBarang} ${b.brand}`.toLowerCase();
      return terms.every(term => value.includes(term));
    });
  }, [barangData, productSearch]);
  const { data: bankData } = useListMasterBank();
  const { data: osData } = useListMasterOnlineShop();
  const { data: customerData } = useListCustomer();
  
  const createMutation = useCreatePenjualan();
  const updateMutation = useUpdatePenjualan();
  const deleteMutation = useDeletePenjualan();

  const checkPermission = (action: string) => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions['Penjualan'] || permissions['penjualan'] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canAdd = checkPermission('add');
  const canEdit = checkPermission('edit');
  const canDelete = checkPermission('delete');
  const canExport = checkPermission('export');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tanggal: formatDateToYYYYMMDD(new Date()),
      kodeBarang: "",
      harga: 0,
      qty: 1,
      noFaktur: "",
      paymentMethod: "cash",
    }
  });

  const watchKodeBarang = form.watch("kodeBarang");
  const watchPaymentMethod = form.watch("paymentMethod");
  const watchHarga = form.watch("harga");
  const watchQty = form.watch("qty");
  
  const total = (watchHarga || 0) * (watchQty || 0);

  // Pre-calculate selected product info for faster rendering
  const selectedBarangInfo = useMemo(() => {
    if (!watchKodeBarang || !barangData) return null;
    return barangData.find(x => x.kodeBarang === watchKodeBarang);
  }, [watchKodeBarang, barangData]);

  // Auto-fill product details when kodeBarang changes
  useEffect(() => {
    if (selectedBarangInfo) {
      if (form.getValues("harga") === 0) {
        form.setValue("harga", selectedBarangInfo.hargaJual);
      }
    }
  }, [selectedBarangInfo, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = { 
        ...values,
        nilaiCash: values.paymentMethod === 'cash' ? total : null,
        nilaiBank: values.paymentMethod === 'bank' ? total : null,
        nilaiOnlineShop: values.paymentMethod === 'online_shop' ? total : null,
        nilaiKredit: values.paymentMethod === 'kredit' ? total : null,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload as any });
        toast({ title: "Success", description: "Transaction updated." });
        setEditingId(null);
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Success", description: "Transaction saved." });
      }

      form.reset({
        tanggal: values.tanggal,
        kodeBarang: "",
        harga: 0,
        qty: 1,
        noFaktur: "",
        paymentMethod: "cash",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/penjualan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    form.reset({
      tanggal: item.tanggal,
      kodeBarang: item.kodeBarang,
      harga: item.harga,
      qty: item.qty,
      noFaktur: item.noFaktur || "",
      paymentMethod: item.paymentMethod,
      nilaiCash: item.nilaiCash,
      namaBank: item.namaBank,
      nilaiBank: item.nilaiBank,
      namaOnlineShop: item.namaOnlineShop,
      nilaiOnlineShop: item.nilaiOnlineShop,
      namaCustomer: item.namaCustomer,
      nilaiKredit: item.nilaiKredit,
    });
    document.getElementById('form-transaksi')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id: number) => {
    console.log("Attempting to delete ID:", id);
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Terhapus", description: "Transaksi berhasil dihapus dari sistem." });
      queryClient.invalidateQueries({ queryKey: ["/api/penjualan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({ title: "Gagal Hapus", description: err.message, variant: "destructive" });
    }
  };

  const exportExcel = () => {
    if (!listData) return;
    const ws = XLSX.utils.json_to_sheet((listData as any[]).map((d: any) => ({
      Tanggal: d.tanggal,
      "No Faktur": d.noFaktur || "-",
      TRX: d.kodeTransaksi,
      Barang: d.namaBarang,
      Brand: d.brand,
      Harga: d.harga,
      Qty: d.qty,
      Total: d.total,
      Metode: d.paymentMethod.toUpperCase(),
      Status: d.statusCair || '-'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan");
    const filename = selectedMonth === "all" ? `Penjualan_Tahun_${selectedYear}.xlsx` : `Penjualan_${selectedMonth}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportPDF = () => {
    if (!listData) return;
    const doc = new jsPDF();
    const periodStr = selectedMonth === "all" ? `${selectedYear}` : `${selectedMonth}-${selectedYear}`;
    doc.text(`Laporan Penjualan - ${periodStr}`, 14, 15);
    
    autoTable(doc, {
      startY: 20,
      head: [['Tanggal', 'No Faktur', 'TRX', 'Barang', 'Qty', 'Total', 'Metode']],
      body: (listData as any[]).map((d: any) => [
        formatDate(d.tanggal),
        d.noFaktur || "-",
        d.kodeTransaksi,
        d.namaBarang,
        d.qty,
        formatRupiah(d.total),
        d.paymentMethod.toUpperCase()
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 69, 0] }
    });
    
    const filename = selectedMonth === "all" ? `Penjualan_Tahun_${selectedYear}.pdf` : `Penjualan_${selectedMonth}_${selectedYear}.pdf`;
    doc.save(filename);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "all", label: "Setahun Penuh" },
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" }
  ];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2 md:gap-3">
            <ShoppingCart className="text-primary w-6 h-6 md:w-8 md:h-8" /> Input Penjualan
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Catat transaksi penjualan baru dengan cepat.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Form Card (Full Width) */}
        {(editingId ? canEdit : canAdd) && (

        <Card id="form-transaksi" className="border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader className="border-b border-border/50 bg-secondary/30 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> {editingId ? "Revisi Transaksi" : "Transaksi Baru"}
            </CardTitle>
            {canEdit && editingId && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setEditingId(null);
                  form.reset({
                    tanggal: formatDateToYYYYMMDD(new Date()),
                    kodeBarang: "",
                    harga: 0,
                    qty: 1,
                    noFaktur: "",
                    paymentMethod: "cash",
                  });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" /> Batal Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Basic Group */}
                <div className="space-y-4">
                  <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-primary/30 rounded-lg transition-all">
                    <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Tanggal</label>
                    <Controller
                      name="tanggal"
                      control={form.control}
                      render={({ field }) => (
                        <DatePicker 
                          date={field.value ? new Date(field.value) : undefined}
                          onChange={(date) => field.onChange(formatDateToYYYYMMDD(date))}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-primary/30 rounded-lg transition-all">
                    <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">No Faktur</label>
                    <input type="text" {...form.register("noFaktur")} placeholder="Contoh: INV-001" className="w-full bg-background border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none shadow-sm" />
                  </div>
                </div>

                {/* Product Group */}
                <div className="space-y-4 lg:col-span-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Pilih Produk</label>
                      <Controller
                        name="kodeBarang"
                        control={form.control}
                        render={({ field }) => (
                          <Popover 
                            open={openBarang} 
                            onOpenChange={(open) => {
                              setOpenBarang(open);
                              if (!open) setProductSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openBarang}
                                className="w-full justify-between bg-background border-border/50 text-left font-normal h-10 shadow-sm"
                              >
                                <span className="truncate">
                                  {selectedBarangInfo 
                                    ? `${selectedBarangInfo.kodeBarang} - ${selectedBarangInfo.namaBarang}`
                                    : "Cari Produk..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 shadow-2xl border-primary/20" align="start">
                              <Command filter={() => 1}>
                                <CommandInput 
                                  placeholder="Cari kode atau nama barang..." 
                                  onValueChange={setProductSearch}
                                />
                                <CommandList className="max-h-[350px]">
                                  <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                  <CommandGroup>
                                    {filteredBarang.slice(0, 100).map((b) => (
                                      <CommandItem
                                        key={b.id}
                                        value={`${b.kodeBarang} ${b.namaBarang} ${b.brand}`}
                                        onSelect={() => {
                                          form.setValue("kodeBarang", b.kodeBarang);
                                          setOpenBarang(false);
                                        }}
                                        className="py-3 px-4"
                                      >
                                        <div className="flex flex-col flex-1 overflow-hidden">
                                          <div className="flex justify-between items-center w-full">
                                            <span className="font-black text-sm text-primary">{b.kodeBarang}</span>
                                            <span className="text-xs font-medium tracking-tight text-emerald-500 font-black">{formatRupiah(b.hargaBeli || 0)}</span>
                                          </div>
                                          <span className="text-[11px] font-bold text-foreground line-clamp-1">{b.namaBarang}</span>
                                          <span className="text-xs italic tracking-tighter text-muted-foreground/60 uppercase tracking-tighter">{b.brand} • Stok Tersedia</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                    </div>
                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-primary/30 rounded-lg transition-all">
                      <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Qty</label>
                      <input 
                        type="number" 
                        min="1" 
                        {...form.register("qty")} 
                        onFocus={(e) => { if (form.getValues("qty") === 0) form.setValue("qty", "" as any); }}
                        className="w-full bg-background border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none shadow-sm font-bold" 
                      />
                    </div>
                  </div>
                  
                  {selectedBarangInfo && (
                    <div className="flex gap-4 px-1 animate-in fade-in slide-in-from-left-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs italic tracking-tighter font-black uppercase text-primary/40 tracking-widest">Brand:</span>
                        <span className="text-xs font-medium tracking-tight font-bold text-primary uppercase">{selectedBarangInfo.brand}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs italic tracking-tighter font-black uppercase text-emerald-500/40 tracking-widest">Harga Beli:</span>
                        <span className="text-xs font-medium tracking-tight font-bold text-emerald-600">{formatRupiah(selectedBarangInfo.hargaBeli || 0)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-primary/30 rounded-lg transition-all">
                      <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Harga Satuan (Rp)</label>
                      <input 
                        type="number" 
                        {...form.register("harga")} 
                        onFocus={(e) => { if (form.getValues("harga") === 0) form.setValue("harga", "" as any); }}
                        className="w-full bg-background border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:border-primary outline-none shadow-sm font-bold text-primary" 
                      />
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-col justify-center">
                      <span className="text-xs italic tracking-tighter font-black uppercase text-primary/60 tracking-widest leading-tight">Total Penjualan</span>
                      <span className="text-xl font-black text-primary leading-tight">{formatRupiah(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Group */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Metode Pembayaran</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['cash', 'bank', 'online_shop', 'kredit'].map((method) => (
                        <label key={method} className={cn(
                          "flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-all text-xs font-medium tracking-tight font-black uppercase tracking-tighter",
                          watchPaymentMethod === method 
                            ? "border-primary bg-primary text-white shadow-md shadow-primary/20" 
                            : "border-border/50 bg-background hover:bg-secondary/50 text-muted-foreground"
                        )}>
                          <input type="radio" value={method} {...form.register("paymentMethod")} className="sr-only" />
                          <span>{method.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {watchPaymentMethod === 'bank' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <select {...form.register("namaBank")} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary shadow-sm" required>
                        <option value="">-- Nama Bank --</option>
                        {bankData?.map(b => <option key={b.id} value={b.namaBank}>{b.namaBank} ({b.nomorRekening})</option>)}
                      </select>
                    </div>
                  )}

                  {watchPaymentMethod === 'online_shop' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <select {...form.register("namaOnlineShop")} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary shadow-sm" required>
                        <option value="">-- Platform OS --</option>
                        {osData?.map(o => <option key={o.id} value={o.namaOnlineShop}>{o.namaOnlineShop}</option>)}
                      </select>
                    </div>
                  )}

                  {watchPaymentMethod === 'kredit' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <select {...form.register("namaCustomer")} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary shadow-sm" required>
                        <option value="">-- Customer --</option>
                        {customerData?.map(c => <option key={c.id} value={c.namaCustomer}>{c.namaCustomer}</option>)}
                      </select>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="w-full py-5 font-black uppercase tracking-widest text-sm h-auto shadow-lg shadow-primary/20"
                  >
                    {createMutation.isPending || updateMutation.isPending 
                      ? "Proses Data..." 
                      : editingId 
                        ? <><Check className="w-4 h-4 mr-2"/> Simpan Revisi</>
                        : <><Plus className="w-4 h-4 mr-2"/> Simpan Transaksi</>
                    }
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        )}

        {/* List Card (Full Width) */}
        <Card className="border-border/50 shadow-xl shadow-muted/5 overflow-hidden">
          <CardHeader className="border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between py-4 bg-muted/20 gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 uppercase tracking-tight font-black">
                <FileBarChart className="w-5 h-5 text-muted-foreground" /> Daftar Penjualan
              </CardTitle>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{getIndonesianPeriodLabel(selectedMonth, selectedYear)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari transaksi..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-background border-border/50 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 bg-background border border-border/50 rounded-lg px-2 py-1 shadow-sm h-9">
                <span className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-tighter">Status:</span>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium tracking-tight font-bold outline-none cursor-pointer p-0.5 min-w-[80px]"
                >
                  <option value="all" className="bg-card text-foreground">SEMUA</option>
                  <option value="cair" className="bg-card text-foreground">CAIR / SELESAI</option>
                  <option value="pending" className="bg-card text-foreground">BELUM CAIR</option>
                </select>
              </div>
              {canExport && (

                <div className="flex gap-2">
                  <Button onClick={exportExcel} variant="outline" size="sm" className="bg-emerald-600/5 text-emerald-600 border-emerald-600/20 hover:bg-emerald-600 hover:text-white transition-all font-bold">
                    <Download className="w-4 h-4 mr-2" /> Excel
                  </Button>
                  <Button onClick={exportPDF} variant="outline" size="sm" className="bg-rose-500/5 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all font-bold">
                    <FileText className="w-4 h-4 mr-2" /> PDF
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 table-container mobile-scroll-hint">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs font-medium tracking-tight text-muted-foreground uppercase bg-secondary/40 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-black tracking-widest">Tanggal</th>
                    <th className="px-4 py-4 font-black tracking-widest text-primary">Kode</th>
                    <th className="px-4 py-4 font-black tracking-widest">Faktur / Ref</th>
                    <th className="px-4 py-4 font-black tracking-widest">Produk & Brand</th>
                    <th className="px-4 py-4 text-right font-black tracking-widest">Harga</th>
                    <th className="px-4 py-4 text-center font-black tracking-widest">Qty</th>
                    <th className="px-4 py-4 text-right font-black tracking-widest">Total</th>
                    <th className="px-4 py-4 font-black tracking-widest">Pembayaran</th>
                    <th className="px-6 py-4 text-center font-black tracking-widest">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {isLoading ? (
                    <tr><td colSpan={9} className="text-center py-20 text-muted-foreground italic font-medium">Memuat data transaksi...</td></tr>
                  ) : filteredListData?.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-20 text-muted-foreground font-bold italic">Tidak ada transaksi dengan status ini.</td></tr>
                  ) : filteredListData?.map((item) => (
                    <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors group/row">
                      <td className="px-5 py-4 whitespace-nowrap font-medium text-muted-foreground">{formatDate(item.tanggal)}</td>
                      <td className="px-3 py-4 font-black text-primary tracking-tighter text-xs font-medium tracking-tight">{item.kodeBarang}</td>
                      <td className="px-4 py-4">
                        <div className="font-black text-foreground">{item.noFaktur || '-'}</div>
                        <div className="font-mono text-xs italic tracking-tighter text-muted-foreground/60 leading-none mt-1 tracking-tighter">{item.kodeTransaksi}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-foreground">{item.namaBarang}</div>
                        <div className="text-xs italic tracking-tighter text-primary font-black uppercase mt-1 tracking-widest">{item.brand}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium">{formatRupiah(item.harga)}</td>
                      <td className="px-4 py-4 text-center font-black">{item.qty}</td>
                      <td className="px-4 py-4 text-right font-black text-emerald-500">{formatRupiah(item.total)}</td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 text-xs italic tracking-tighter font-black uppercase rounded tracking-tighter",
                          item.paymentMethod === 'cash' ? 'bg-emerald-500/10 text-emerald-600' : 
                            item.paymentMethod === 'bank' ? 'bg-blue-500/10 text-blue-600' : 
                            item.paymentMethod === 'online_shop' ? 'bg-purple-500/10 text-purple-600' : 
                            'bg-orange-500/10 text-orange-600'
                        )}>
                          {item.paymentMethod.replace('_', ' ')}
                        </span>
                        {item.statusCair === 'pending' && <div className="text-xs italic tracking-tighter text-rose-500 mt-1 font-black animate-pulse uppercase">Belum Cair</div>}
                        {item.statusCair === 'partial' && (
                          <div className="mt-1">
                            <div className="text-xs italic tracking-tighter text-orange-500 font-black uppercase">Cicilan</div>
                            <div className="text-xs font-bold leading-none text-muted-foreground font-bold">Sisa: {formatRupiah(item.total - item.totalPaid)}</div>
                          </div>
                        )}
                        {item.statusCair === 'cair' && <div className="text-xs italic tracking-tighter text-emerald-500 mt-1 font-black uppercase">Selesai</div>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canEdit && (
                            <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-500/20 shadow-sm"><Pencil className="w-3.5 h-3.5" /></button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => {
                                if ((item.totalPaid || 0) > 0) {
                                  toast({
                                    title: "Tindakan Ditolak",
                                    description: `Transaksi ini sudah masuk di Pencairan Perbank (${formatRupiah(item.totalPaid)}). Silakan batalkan pencairan terlebih dahulu.`,
                                    variant: "destructive"
                                  });
                                } else {
                                  setDeleteConfirmId(item.id);
                                }
                              }} 
                              className={cn(
                                "p-1.5 rounded-lg transition-colors border shadow-sm",
                                (item.totalPaid || 0) > 0
                                  ? "text-muted-foreground/30 border-muted-foreground/10 cursor-not-allowed"
                                  : "text-rose-500 hover:bg-rose-500/10 border-rose-500/20"
                              )}
                              title={(item.totalPaid || 0) > 0 ? "Sudah masuk pencairan" : "Hapus Transaksi"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3 p-2">
              {isLoading ? (
                <div className="text-center py-20">
                   <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
                   <p className="text-muted-foreground animate-pulse font-bold text-sm uppercase tracking-widest">Memuat Transaksi...</p>
                </div>
              ) : filteredListData?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground font-black uppercase text-sm tracking-tighter opacity-50 border-2 border-dashed border-border/20 rounded-2xl">
                  Belum ada data.
                </div>
              ) : filteredListData?.map((item) => (
                <div key={item.id} className="p-5 bg-card/40 rounded-2xl border border-border/20 shadow-sm active:bg-secondary/20 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium tracking-tight font-black text-primary uppercase tracking-widest">{formatDate(item.tanggal)}</div>
                      <div className="text-sm font-black text-foreground tracking-tight">{item.noFaktur || '-'}</div>
                      <div className="text-xs italic tracking-tighter font-mono text-muted-foreground/60 tracking-tighter uppercase">{item.kodeTransaksi}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn(
                        "px-2.5 py-1 text-xs italic tracking-tighter font-black uppercase rounded-lg tracking-wider border",
                        item.paymentMethod === 'cash' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          item.paymentMethod === 'bank' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                          item.paymentMethod === 'online_shop' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 
                          'bg-orange-500/10 text-orange-500 border-orange-500/20'
                      )}>
                        {item.paymentMethod.replace('_', ' ')}
                      </span>
                      {item.statusCair === 'pending' && <span className="text-xs font-bold leading-none bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-rose-500/20">Pending</span>}
                      {item.statusCair === 'partial' && <span className="text-xs font-bold leading-none bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-orange-500/20">Cicilan</span>}
                      {item.statusCair === 'cair' && <span className="text-xs font-bold leading-none bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-emerald-500/20">Selesai</span>}
                    </div>
                  </div>
                  
                  <div className="py-3 px-4 bg-secondary/30 rounded-xl border border-border/10 mb-4">
                    <div className="text-sm font-black text-foreground mb-1">{item.namaBarang}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs italic tracking-tighter font-black text-primary/80 uppercase tracking-widest">{item.brand} • {item.kodeBarang}</span>
                      <span className="text-sm font-black text-muted-foreground tabular-nums">{item.qty} <span className="text-xs font-bold leading-none">PKT/PCS</span></span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold leading-none font-black text-muted-foreground uppercase tracking-wider">Total Transaksi</div>
                      <div className="text-base font-black text-emerald-500 leading-none">{formatRupiah(item.total)}</div>
                    </div>
                    <div className="flex gap-2">
                       {canEdit && (
                         <button 
                           onClick={() => handleEdit(item)} 
                           className="p-2.5 text-blue-400 hover:text-blue-300 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl border border-blue-500/20 transition-colors shadow-sm active:scale-90"
                         >
                           <Pencil className="w-4 h-4" />
                         </button>
                       )}
                       {canDelete && (
                         <button 
                           onClick={() => {
                            if ((item.totalPaid || 0) > 0) {
                              toast({
                                title: "Ditolak",
                                description: "Sudah masuk pencairan. Batalkan di menu Pencairan.",
                                variant: "destructive"
                              });
                            } else {
                              setDeleteConfirmId(item.id);
                            }
                           }} 
                           className={cn(
                             "p-2.5 rounded-xl border transition-colors shadow-sm active:scale-90",
                             (item.totalPaid || 0) > 0
                               ? "text-muted-foreground/30 border-muted-foreground/10"
                               : "text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20"
                           )}
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Transaksi akan dihapus permanen dari database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
