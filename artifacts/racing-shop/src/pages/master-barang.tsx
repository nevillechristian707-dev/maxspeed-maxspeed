import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMasterBarang, useCreateMasterBarang, useUpdateMasterBarang, useDeleteMasterBarang, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package, Plus, Trash2, Edit2, Search, Upload, Download, ClipboardPaste, X, CheckCircle, AlertCircle, FileSpreadsheet, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TEMPLATE_COLUMNS = ["Kode Barang", "Nama Barang", "Brand", "Supplier", "Harga Beli", "Harga Jual"];
const COL_MAP: Record<string, string> = {
  "kode barang": "kodeBarang", "kode": "kodeBarang", "sku": "kodeBarang",
  "nama barang": "namaBarang", "nama": "namaBarang", "item name": "namaBarang",
  "brand": "brand", "merk": "brand",
  "supplier": "supplier", "vendor": "supplier",
  "harga beli": "hargaBeli", "h beli": "hargaBeli", "hbeli": "hargaBeli", "buy price": "hargaBeli",
  "harga jual": "hargaJual", "h jual": "hargaJual", "hjual": "hargaJual", "sell price": "hargaJual",
};

function parseNumeric(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const s = String(val).trim();
  if (!s) return 0;
  const sanitized = s.replace(/[^\d.,-]/g, '');
  const lastDot = sanitized.lastIndexOf('.');
  const lastComma = sanitized.lastIndexOf(',');
  const lastIdx = Math.max(lastDot, lastComma);
  if (lastIdx === -1) return parseFloat(sanitized.replace(/[^\d-]/g, '')) || 0;
  const suffix = sanitized.substring(lastIdx + 1);
  if (suffix.length === 3) return parseFloat(sanitized.replace(/[^\d-]/g, '')) || 0;
  const integerPart = sanitized.substring(0, lastIdx).replace(/[^\d-]/g, '');
  const decimalPart = suffix.replace(/[^\d]/g, '');
  return parseFloat(`${integerPart || '0'}.${decimalPart}`) || 0;
}

function parseRowsToItems(rows: any[][]): any[] {
  if (!rows.length) return [];
  const header = rows[0].map((h: any) => String(h ?? "").toLowerCase().trim());
  const mapping: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = COL_MAP[h];
    if (key) mapping[key] = i;
  });
  if (Object.values(mapping).length < 2) {
    return rows.map(r => ({
      kodeBarang: String(r[0] ?? "").trim(),
      namaBarang: String(r[1] ?? "").trim(),
      brand: String(r[2] ?? "").trim(),
      supplier: String(r[3] ?? "-").trim(),
      hargaBeli: parseNumeric(r[4]),
      hargaJual: parseNumeric(r[5]),
    })).filter(item => item.kodeBarang && item.namaBarang);
  }
  return rows.slice(1).filter(r => r.some(v => v !== undefined && v !== null && v !== "")).map(r => {
    const obj: any = {};
    Object.keys(mapping).forEach(key => {
      const idx = mapping[key];
      obj[key] = (key === "hargaBeli" || key === "hargaJual") ? parseNumeric(r[idx]) : String(r[idx] ?? "").trim();
    });
    if (!obj.supplier) obj.supplier = "-";
    if (obj.hargaBeli === undefined) obj.hargaBeli = 0;
    if (obj.hargaJual === undefined) obj.hargaJual = 0;
    return obj;
  }).filter(item => item.kodeBarang && item.namaBarang);
}

export default function MasterBarang() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListMasterBarang();
  const createMutation = useCreateMasterBarang();
  const updateMutation = useUpdateMasterBarang();
  const deleteMutation = useDeleteMasterBarang();
  const { data: user } = useGetMe();

  const checkPermission = (menu: string, action: string) => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions[menu] || permissions[menu.toLowerCase()] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canAdd = checkPermission('Master Barang', 'add');
  const canEdit = checkPermission('Master Barang', 'edit');
  const canDelete = checkPermission('Master Barang', 'delete');
  const canExport = checkPermission('Master Barang', 'export');

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ kodeBarang: "", namaBarang: "", brand: "", supplier: "", hargaBeli: "", hargaJual: "" });
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        kodeBarang: form.kodeBarang,
        namaBarang: form.namaBarang,
        brand: form.brand,
        supplier: form.supplier || "-",
        hargaBeli: parseNumeric(form.hargaBeli),
        hargaJual: parseNumeric(form.hargaJual),
      };
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Berhasil diupdate" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Barang ditambahkan" });
      }
      setForm({ kodeBarang: "", namaBarang: "", brand: "", supplier: "", hargaBeli: "", hargaJual: "" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/master-barang"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setForm({ kodeBarang: item.kodeBarang, namaBarang: item.namaBarang, brand: item.brand, supplier: item.supplier, hargaBeli: item.hargaBeli.toString(), hargaJual: item.hargaJual.toString() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus barang ini?")) return;
    await deleteMutation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["/api/master-barang"] });
    toast({ title: "Barang dihapus" });
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      ["BRG001", "Helm Racing Full Face", "Arai", "PT Sumber Motor", 1200000, 1750000],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Barang");
    XLSX.writeFile(wb, "template_master_barang.xlsx");
    toast({ title: "Template didownload" });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import("xlsx");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const items = parseRowsToItems(rows);
        setPreviewItems(items);
      } catch {
        toast({ title: "Gagal membaca Excel", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleBulkImport = async () => {
    if (!previewItems.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/master-barang/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: previewItems }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal simpan data");
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/master-barang"] });
      toast({ title: "Import Berhasil" });
    } catch (err: any) {
      toast({ title: "Import gagal", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const filteredData = data?.filter(item =>
    item.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
    item.kodeBarang.toLowerCase().includes(search.toLowerCase()) ||
    item.brand.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-6">
        <div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl nm-flat bg-neu-bg">
              <Package className="text-neu-accent w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-black text-neu-text tracking-tight">Master Barang</h1>
              <p className="text-neu-text mt-1 text-sm font-black">Inventaris Multi-Channel Marketplace</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="default" onClick={() => setShowImport(!showImport)} className="gap-2">
            <Upload className="w-4 h-4" /> Import Data
          </Button>
          <Button variant="neumorphic" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" /> Template
          </Button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && canAdd && (
        <Card className="mb-12 nm-inset border-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-neu-accent" /> Import Wizard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div 
                onClick={() => fileRef.current?.click()}
                className="border-4 border-dashed border-neu-dark/20 rounded-neu p-12 text-center cursor-pointer hover:bg-white/30 transition-all group"
              >
                <Upload className="w-12 h-12 text-neu-dark mx-auto mb-4 group-hover:text-neu-accent group-hover:scale-110 transition-all" />
                <p className="text-neu-text font-black uppercase tracking-widest text-xs">Pilih File Excel</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              </div>
              <div className="space-y-4">
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste data Excel di sini..."
                  className="w-full h-32 bg-neu-bg nm-inset rounded-2xl p-4 text-sm font-mono outline-none focus:ring-2 ring-neu-accent/20 resize-none border-none"
                />
                <Button onClick={() => toast({ title: "Fitur Paste segera hadir" })} variant="secondary" className="w-full">Preview Paste</Button>
              </div>
            </div>
            
            {previewItems.length > 0 && !importResult && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-black text-neu-text uppercase tracking-widest">{previewItems.length} Produk Terdeteksi</p>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewItems([])}><X className="w-4 h-4" /></Button>
                </div>
                <Button onClick={handleBulkImport} disabled={importing} className="w-full h-14 text-lg">
                  {importing ? "Sedang Memproses..." : "Konfirmasi Import Data"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Tambah/Edit */}
      {(canAdd || editingId) && (
        <Card className="mb-12 nm-flat bg-neu-bg/50">
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? "Update Data Barang" : "Tambah Barang Baru"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-neu-text tracking-widest ml-1">Kode Barang</label>
                <input required value={form.kodeBarang} onChange={e => setForm({...form, kodeBarang: e.target.value})} className="w-full h-12 bg-neu-bg nm-inset rounded-2xl px-4 outline-none border-none focus:ring-2 ring-neu-accent/20 text-neu-text font-bold" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-black uppercase text-neu-text tracking-widest ml-1">Nama Barang</label>
                <input required value={form.namaBarang} onChange={e => setForm({...form, namaBarang: e.target.value})} className="w-full h-12 bg-neu-bg nm-inset rounded-2xl px-4 outline-none border-none focus:ring-2 ring-neu-accent/20 text-neu-text font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-neu-dark tracking-widest ml-1">Brand</label>
                <input required value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className="w-full h-12 bg-neu-bg nm-inset rounded-2xl px-4 outline-none border-none focus:ring-2 ring-neu-accent/20" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-neu-dark tracking-widest ml-1">Harga Beli</label>
                <input required type="number" value={form.hargaBeli} onChange={e => setForm({...form, hargaBeli: e.target.value})} className="w-full h-12 bg-neu-bg nm-inset rounded-2xl px-4 outline-none border-none focus:ring-2 ring-neu-accent/20" />
              </div>
              <div className="space-y-2 text-right">
                <label className="text-xs font-black uppercase text-neu-dark tracking-widest mr-1">Harga Jual</label>
                <input required type="number" value={form.hargaJual} onChange={e => setForm({...form, hargaJual: e.target.value})} className="w-full h-12 bg-neu-bg nm-inset rounded-2xl px-4 outline-none border-none focus:ring-2 ring-neu-accent/20 text-right font-black text-neu-accent" />
              </div>
              <div className="lg:col-span-3 flex justify-end gap-4 mt-4 pt-8 border-t border-neu-dark/5">
                {editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setForm({kodeBarang:"",namaBarang:"",brand:"",supplier:"",hargaBeli:"",hargaJual:""}) }}>Batal</Button>}
                <Button type="submit" size="lg" className="px-12 font-black">{editingId ? "Update Data" : "Simpan Produk"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Inventory Table */}
      <Card className="nm-flat">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-8 gap-4">
          <div>
            <CardTitle className="text-xl">Daftar Inventaris Multi-Channel</CardTitle>
            <CardDescription>Sinkronisasi stok real-time antar marketplace</CardDescription>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neu-text" />
            <input 
              type="text" 
              placeholder="Cari produk..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-11 pr-6 py-3 bg-neu-bg nm-inset rounded-full text-sm outline-none w-full md:w-72 border-none text-neu-text font-bold placeholder:text-neu-text/30"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto px-4 pb-8">
            <Table>
              <TableHeader>
                <TableRow className="nm-flat bg-neu-bg/50 hover:scale-100">
                  <TableHead className="w-[300px] text-neu-text font-black uppercase text-[10px] tracking-widest">Nama Produk</TableHead>
                  <TableHead className="text-center text-neu-text font-black uppercase text-[10px] tracking-widest">Total Stok</TableHead>
                  <TableHead className="text-center text-rose-600 font-black uppercase text-[10px] tracking-widest">Shopee</TableHead>
                  <TableHead className="text-center text-emerald-600 font-black uppercase text-[10px] tracking-widest">Tokopedia</TableHead>
                  <TableHead className="text-center text-black font-black uppercase text-[10px] tracking-widest">TikTok</TableHead>
                  <TableHead className="text-right text-neu-text font-black uppercase text-[10px] tracking-widest">Harga Jual</TableHead>
                  <TableHead className="text-center text-neu-text font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                  <TableHead className="text-center text-neu-text font-black uppercase text-[10px] tracking-widest">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-20 text-neu-text font-black uppercase">Mensinkronkan data...</TableCell></TableRow>
                ) : paginatedData?.map(item => {
                  // Mock stocks for demo purposes as per user's design
                  const totalStok = Math.floor(Math.random() * 500) + 100;
                  const shopee = Math.floor(totalStok * 0.4);
                  const tokopedia = Math.floor(totalStok * 0.35);
                  const tiktok = totalStok - shopee - tokopedia;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-black text-neu-text">{item.namaBarang}</div>
                        <div className="text-[10px] font-mono text-neu-text font-black uppercase mt-1 tracking-widest">{item.kodeBarang} • {item.brand}</div>
                      </TableCell>
                      <TableCell className="text-center font-black text-neu-text text-lg">{totalStok}</TableCell>
                      <TableCell className="text-center font-bold text-rose-500">{shopee}</TableCell>
                      <TableCell className="text-center font-bold text-emerald-500">{tokopedia}</TableCell>
                      <TableCell className="text-center font-bold text-black">{tiktok}</TableCell>
                      <TableCell className="text-right font-black text-neu-accent">{formatRupiah(item.hargaBeli)}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d1d9e6] text-[10px] font-black text-emerald-600 uppercase tracking-widest nm-inset">
                          <CheckCircle className="w-3 h-3" /> Synced
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {canEdit && <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit2 className="w-4 h-4 text-blue-500"/></Button>}
                          {canDelete && <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-rose-500"/></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!filteredData?.length && !isLoading && (
              <div className="text-center py-20 bg-neu-bg nm-inset rounded-neu mx-2 mb-4">
                <Package className="w-12 h-12 text-neu-text/20 mx-auto mb-4" />
                <p className="text-neu-text font-black uppercase tracking-widest text-xs">Belum ada data barang tersedia</p>
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-8 py-6 border-t border-neu-bg">
              <p className="text-[10px] font-black text-neu-text uppercase tracking-widest">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} products
              </p>
              <div className="flex items-center gap-4">
                <Button 
                  variant="neumorphic" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 p-0 rounded-full"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum + (5-i) > totalPages) pageNum = totalPages - 4 + i;
                    }
                    if (pageNum <= 0) return null;
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-10 h-10 rounded-xl text-xs font-black transition-all",
                          currentPage === pageNum 
                            ? "nm-inset text-neu-accent bg-neu-bg/20" 
                            : "text-neu-text font-black hover:bg-neu-bg/30"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button 
                  variant="neumorphic" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 p-0 rounded-full"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-12 flex justify-center pb-20">
         <Button variant="neumorphic" size="lg" className="gap-3 px-12 group">
            <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
            Sync All Channels
         </Button>
      </div>
    </Layout>
  );
}
