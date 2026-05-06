import { useState, useMemo, useEffect, memo } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Trash2, Download, Search, FileText, Check, ChevronsUpDown, Calendar, FileDown, FileBarChart, Pencil, X, Printer } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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

const MemoizedTableRow = memo(({ item, handleEdit, handleDelete, handlePrint, handlePDF, canEdit, canDelete }: any) => {
  return (
    <TableRow>
      <TableCell className="text-neu-dark font-medium whitespace-nowrap">{formatDate(item.tanggal)}</TableCell>
      <TableCell className="font-black text-neu-accent tracking-tighter text-xs">{item.kodeBarang}</TableCell>
      <TableCell>
        <div className="font-black text-neu-text">{item.noFaktur || '-'}</div>
        <div className="font-mono text-[10px] italic text-neu-text font-black mt-1 uppercase tracking-widest">{item.kodeTransaksi}</div>
      </TableCell>
      <TableCell>
        <div className="font-black text-neu-text line-clamp-1">{item.namaBarang}</div>
        <div className="text-[10px] italic text-neu-accent font-black uppercase mt-1 tracking-widest">{item.brand}</div>
      </TableCell>
      <TableCell className="text-right font-medium">{formatRupiah(item.harga)}</TableCell>
      <TableCell className="text-center font-black">{item.qty}</TableCell>
      <TableCell className="text-right font-black text-emerald-600">{formatRupiah(item.total)}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5 items-start">
          <span className={cn(
            "px-2.5 py-0.5 text-[9px] font-black uppercase rounded-full nm-inset",
            item.paymentMethod === 'cash' ? 'text-emerald-600' : 
              item.paymentMethod === 'bank' ? 'text-blue-600' : 
              item.paymentMethod === 'online_shop' ? 'text-purple-600' : 
              'text-orange-600'
          )}>
            {item.paymentMethod.replace('_', ' ')}
          </span>
          {item.statusCair === 'pending' && <div className="text-[9px] italic text-rose-500 font-black animate-pulse uppercase ml-1">Belum Cair</div>}
          {item.statusCair === 'partial' && (
            <div className="ml-1">
              <div className="text-[9px] italic text-orange-500 font-black uppercase">Cicilan</div>
              <div className="text-[9px] font-bold text-neu-dark">Sisa: {formatRupiah(item.total - item.totalPaid)}</div>
            </div>
          )}
          {item.statusCair === 'cair' && <div className="text-[9px] italic text-emerald-500 font-black uppercase ml-1">Selesai</div>}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handlePrint(item)} className="h-8 w-8 p-0 text-emerald-600"><Printer className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handlePDF(item)} className="h-8 w-8 p-0 text-rose-500"><FileText className="w-4 h-4" /></Button>
          {canEdit && <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-8 w-8 p-0 text-blue-500"><Pencil className="w-4 h-4" /></Button>}
          {canDelete && (
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={(item.totalPaid || 0) > 0}
              onClick={() => handleDelete(item.id)}
              className="h-8 w-8 p-0 text-rose-500 disabled:opacity-20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
MemoizedTableRow.displayName = 'MemoizedTableRow';

import { useMonthYear } from "@/context/month-year-context";

const MemoizedMobileCard = memo(({ item, handleEdit, handleDelete, handlePrint, handlePDF, canEdit, canDelete }: any) => {
  return (
    <div className="p-6 bg-neu-bg rounded-neu nm-flat hover:nm-sm transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <div className="text-[10px] font-black text-neu-accent uppercase tracking-[0.2em]">{formatDate(item.tanggal)}</div>
          <div className="text-base font-black text-neu-text tracking-tight">{item.noFaktur || '-'}</div>
          <div className="text-[9px] font-mono text-neu-text font-black uppercase tracking-widest">{item.kodeTransaksi}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn(
            "px-3 py-1 text-[9px] font-black uppercase rounded-full nm-inset",
            item.paymentMethod === 'cash' ? 'text-emerald-600' : 
              item.paymentMethod === 'bank' ? 'text-blue-600' : 
              item.paymentMethod === 'online_shop' ? 'text-purple-600' : 
              'text-orange-600'
          )}>
            {item.paymentMethod.replace('_', ' ')}
          </span>
          <div className="flex gap-1.5">
            {item.statusCair === 'pending' && <span className="text-[8px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-black uppercase">Pending</span>}
            {item.statusCair === 'partial' && <span className="text-[8px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-black uppercase">Cicilan</span>}
            {item.statusCair === 'cair' && <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black uppercase">Selesai</span>}
          </div>
        </div>
      </div>
      
      <div className="py-4 px-5 bg-white/30 rounded-2xl nm-inset mb-6">
        <div className="text-sm font-black text-neu-text mb-1">{item.namaBarang}</div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-black text-neu-accent uppercase tracking-widest">{item.brand} • {item.kodeBarang}</span>
          <span className="text-sm font-black text-neu-dark tabular-nums">{item.qty} <span className="text-[10px]">PCS</span></span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <div className="text-[9px] font-black text-neu-dark uppercase tracking-widest">Total Bayar</div>
          <div className="text-xl font-display font-black text-emerald-600 tracking-tight">{formatRupiah(item.total)}</div>
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" size="icon" onClick={() => handlePrint(item)} className="h-10 w-10 text-emerald-600"><Printer className="w-4 h-4" /></Button>
           <Button variant="ghost" size="icon" onClick={() => handlePDF(item)} className="h-10 w-10 text-rose-500"><FileDown className="w-4 h-4" /></Button>
           {canEdit && <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="h-10 w-10 text-blue-500"><Pencil className="w-4 h-4" /></Button>}
           {canDelete && (
             <Button 
               variant="ghost" 
               size="icon"
               disabled={(item.totalPaid || 0) > 0}
               onClick={() => handleDelete(item.id)}
               className="h-10 w-10 text-rose-500 disabled:opacity-20"
             >
               <Trash2 className="w-4 h-4" />
             </Button>
           )}
        </div>
      </div>
    </div>
  );
});
MemoizedMobileCard.displayName = 'MemoizedMobileCard';

export default function Penjualan() {
  const currentYear = new Date().getFullYear();
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, dateParams } = useMonthYear();
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openBarang, setOpenBarang] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Debounced search for smooth typing on mobile
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  
  const { data: user } = useGetMe();

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
  
  const createMutation = useCreatePenjualan({
    mutation: {
      onMutate: async (newRecord) => {
        await queryClient.cancelQueries({ queryKey: ["/api/penjualan", dateParams] });
        const previousData = queryClient.getQueryData(["/api/penjualan", dateParams]);
        
        // Optimistic update
        queryClient.setQueryData(["/api/penjualan", dateParams], (old: any) => {
          const newItem = { 
            id: Math.random(), // Temporary ID
            ...newRecord.data,
            statusCair: 'pending',
            total: (newRecord.data.harga || 0) * (newRecord.data.qty || 0),
            kodeTransaksi: "MENUNGGU...",
            namaBarang: barangData?.find(b => b.kodeBarang === newRecord.data.kodeBarang)?.namaBarang || "",
            brand: barangData?.find(b => b.kodeBarang === newRecord.data.kodeBarang)?.brand || "",
          };
          return [newItem, ...(old || [])];
        });
        
        return { previousData };
      },
      onError: (err, newRecord, context: any) => {
        queryClient.setQueryData(["/api/penjualan", dateParams], context.previousData);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/penjualan"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
      }
    }
  });

  const updateMutation = useUpdatePenjualan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/penjualan"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
      }
    }
  });

  const deleteMutation = useDeletePenjualan({
    mutation: {
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: ["/api/penjualan", dateParams] });
        const previousData = queryClient.getQueryData(["/api/penjualan", dateParams]);
        
        queryClient.setQueryData(["/api/penjualan", dateParams], (old: any) => 
          (old || []).filter((item: any) => item.id !== id)
        );
        
        return { previousData };
      },
      onError: (err, variables, context: any) => {
        queryClient.setQueryData(["/api/penjualan", dateParams], context.previousData);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/penjualan"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
      }
    }
  });

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
        toast({ title: "Berhasil", description: "Transaksi diperbarui." });
        setEditingId(null);
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Berhasil", description: "Transaksi disimpan." });
      }

      form.reset({
        tanggal: values.tanggal,
        kodeBarang: "",
        harga: 0,
        qty: 1,
        noFaktur: "",
        paymentMethod: "cash",
      });
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.detail || err.message, 
        variant: "destructive" 
      });
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
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Terhapus", description: "Transaksi berhasil dihapus." });
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const exportExcel = async () => {
    if (!listData) return;
    const XLSX = await import("xlsx");
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

  const exportPDF = async () => {
    if (!listData) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
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

  const handlePrintIndividual = (item: any) => {
    // Find grouped items if noFaktur exists
    const groupedItems = (item.noFaktur && item.noFaktur !== "-") 
      ? filteredListData.filter(x => x.noFaktur === item.noFaktur && x.tanggal === item.tanggal)
      : [item];

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const total = groupedItems.reduce((acc, curr) => acc + curr.total, 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Maxspeed - ${item.kodeTransaksi}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 72mm; 
              margin: 0; 
              padding: 4mm;
              color: black;
              font-size: 12px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed black; margin: 4px 0; }
            .header { font-size: 16px; margin-bottom: 2px; }
            .flex { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; }
            td { padding: 2px 0; vertical-align: top; }
            .footer { margin-top: 10px; font-style: italic; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold header">MAXSPEED RACING SHOP</div>
          <div class="text-center">Jl. Raya Otista No. 123</div>
          <div class="text-center">Telp: 0812-3456-7890</div>
          
          <div class="divider"></div>
          
          <div class="flex">
            <span>${formatDate(item.tanggal)}</span>
            <span>${item.kodeTransaksi}</span>
          </div>
          ${item.noFaktur ? `<div>Faktur: ${item.noFaktur}</div>` : ''}
          <div>Metode: ${item.paymentMethod.toUpperCase()}</div>
          
          <div class="divider"></div>
          
          <div class="flex font-bold">
            <span>Item</span>
            <span>Total</span>
          </div>
          
          <table>
            ${groupedItems.map(gi => `
              <tr>
                <td colspan="2">${gi.namaBarang}</td>
              </tr>
              <tr>
                <td>${gi.qty} x ${formatRupiah(gi.harga)}</td>
                <td class="text-right">${formatRupiah(gi.total)}</td>
              </tr>
            `).join('')}
          </table>
          
          <div class="divider"></div>
          
          <div class="flex font-bold" style="font-size: 14px; margin-top: 4px;">
            <span>TOTAL</span>
            <span>${formatRupiah(total)}</span>
          </div>
          
          <div class="footer text-center">
            Terima kasih atas kunjungan Anda!<br>
            Barang yang sudah dibeli tidak dapat ditukar.
          </div>
          
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportPDFIndividual = async (item: any) => {
    const { default: jsPDF } = await import("jspdf");
    // Re-use logic for PDF generation
    const groupedItems = (item.noFaktur && item.noFaktur !== "-")
      ? filteredListData.filter(x => x.noFaktur === item.noFaktur && x.tanggal === item.tanggal)
      : [item];

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200]
    });

    const pageWidth = doc.internal.pageSize.width;
    let y = 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MAXSPEED RACING SHOP", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Jl. Raya Otista No. 123", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.text("Telp: 0812-3456-7890", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, pageWidth - 5, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(formatDate(item.tanggal), 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.kodeTransaksi, pageWidth - 5, y, { align: "right" });
    if (item.noFaktur) { y += 4; doc.text(`Faktur: ${item.noFaktur}`, 5, y); }
    y += 4;
    doc.text(`Metode: ${item.paymentMethod.toUpperCase()}`, 5, y);
    y += 4;
    doc.line(5, y, pageWidth - 5, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Item", 5, y);
    doc.text("Total", pageWidth - 5, y, { align: "right" });
    y += 2;

    let subtotal = 0;
    doc.setFont("helvetica", "normal");
    groupedItems.forEach((gi: any) => {
      y += 4;
      doc.text(gi.namaBarang, 5, y);
      y += 4;
      doc.text(`${gi.qty} x ${formatRupiah(gi.harga)}`, 5, y);
      doc.text(formatRupiah(gi.total), pageWidth - 5, y, { align: "right" });
      subtotal += gi.total;
    });

    y += 6;
    doc.line(5, y, pageWidth - 5, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 5, y);
    doc.text(formatRupiah(subtotal), pageWidth - 5, y, { align: "right" });
    
    y += 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Terima kasih atas kunjungan Anda!", pageWidth / 2, y, { align: "center" });

    doc.save(`Struk_Maxspeed_${item.kodeTransaksi}.pdf`);
  };


  return (
    <Layout>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-6">
        <div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl nm-flat bg-neu-bg">
              <ShoppingCart className="text-neu-accent w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-black text-neu-text tracking-tight">Penjualan</h1>
              <p className="text-neu-dark mt-1 text-sm font-medium">Input & Monitoring Transaksi Penjualan</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 bg-neu-bg p-2 px-4 rounded-neu nm-inset">
            <Calendar className="w-4 h-4 text-neu-accent" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-black text-neu-text outline-none cursor-pointer py-2"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="w-px h-6 bg-neu-dark/20 mx-2" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-transparent text-sm font-black text-neu-text outline-none cursor-pointer py-2"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
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
              <CardTitle className="text-lg flex items-center gap-2 uppercase tracking-tight font-black text-neu-text">
                <FileBarChart className="w-5 h-5 text-neu-accent" /> Daftar Penjualan
              </CardTitle>
              <p className="text-[11px] font-black text-neu-text uppercase tracking-[0.2em]">{getIndonesianPeriodLabel(selectedMonth, selectedYear)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative group flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cari faktur, barang, atau brand..." 
                  className="w-full bg-secondary/40 border border-border/50 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
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
                <thead className="text-xs font-black text-neu-text uppercase bg-neu-bg/50 border-b border-neu-bg">
                  <tr>
                    <th className="px-6 py-4 font-black tracking-widest">Tanggal</th>
                    <th className="px-4 py-4 font-black tracking-widest text-neu-accent">Kode</th>
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
                    <MemoizedTableRow 
                      key={item.id} 
                      item={item} 
                      handleEdit={handleEdit} 
                      handlePrint={handlePrintIndividual}
                      handlePDF={handleExportPDFIndividual}
                      handleDelete={(id: number) => {
                        if ((item.totalPaid || 0) > 0) {
                          toast({ title: "Tindakan Ditolak", description: `Transaksi ini sudah masuk di Pencairan Perbank.`, variant: "destructive" });
                        } else {
                          setDeleteConfirmId(id);
                        }
                      }}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
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
                <MemoizedMobileCard 
                  key={item.id} 
                  item={item} 
                  handleEdit={handleEdit} 
                  handlePrint={handlePrintIndividual}
                  handlePDF={handleExportPDFIndividual}
                  handleDelete={(id: number) => {
                    if ((item.totalPaid || 0) > 0) {
                      toast({ title: "Tindakan Ditolak", description: "Transaksi ini sudah masuk di Pencairan Perbank.", variant: "destructive" });
                    } else {
                      setDeleteConfirmId(id);
                    }
                  }}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
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
