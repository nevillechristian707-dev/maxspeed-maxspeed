import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMasterBarang, useCreateMasterBarang, useUpdateMasterBarang, useDeleteMasterBarang, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Plus, Trash2, Edit2, Search, Upload, Download, ClipboardPaste, X, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const TEMPLATE_COLUMNS = ["Kode Barang", "Nama Barang", "Brand", "Supplier", "Harga Beli", "Harga Jual"];
const COL_MAP: Record<string, string> = {
  "kode barang": "kodeBarang",
  "kode": "kodeBarang",
  "sku": "kodeBarang",
  "nama barang": "namaBarang",
  "nama": "namaBarang",
  "item name": "namaBarang",
  "brand": "brand",
  "merk": "brand",
  "supplier": "supplier",
  "vendor": "supplier",
  "harga beli": "hargaBeli",
  "h beli": "hargaBeli",
  "hbeli": "hargaBeli",
  "buy price": "hargaBeli",
  "harga jual": "hargaJual",
  "h jual": "hargaJual",
  "hjual": "hargaJual",
  "sell price": "hargaJual",
};

function parseNumeric(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const s = String(val).trim();
  if (!s) return 0;
  
  // Remove currency symbols and common non-numeric chars except . and ,
  const sanitized = s.replace(/[^\d.,-]/g, '');
  
  const lastDot = sanitized.lastIndexOf('.');
  const lastComma = sanitized.lastIndexOf(',');
  const lastIdx = Math.max(lastDot, lastComma);
  
  if (lastIdx === -1) {
    return parseFloat(sanitized.replace(/[^\d-]/g, '')) || 0;
  }
  
  const suffix = sanitized.substring(lastIdx + 1);
  if (suffix.length === 3) {
    // Likely thousand separator (e.g. 1.200.000 or 1,200,000)
    return parseFloat(sanitized.replace(/[^\d-]/g, '')) || 0;
  } else {
    // Likely decimal separator (e.g. 1.250,50 or 1,250.50)
    const integerPart = sanitized.substring(0, lastIdx).replace(/[^\d-]/g, '');
    const decimalPart = suffix.replace(/[^\d]/g, '');
    return parseFloat(`${integerPart || '0'}.${decimalPart}`) || 0;
  }
}

function parseRowsToItems(rows: any[][]): any[] {
  if (!rows.length) return [];
  const header = rows[0].map((h: any) => String(h ?? "").toLowerCase().trim());
  
  // Find which column index maps to which key
  const mapping: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = COL_MAP[h];
    if (key) mapping[key] = i;
  });

  // If no columns mapped, try to guess by order if it looks like our standard format
  const keys = Object.values(mapping);
  if (keys.length < 2) {
    // If we only found 0 or 1 mapping, maybe it's the standard order without headers or with unknown headers
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
      const val = r[idx];
      if (key === "hargaBeli" || key === "hargaJual") {
        obj[key] = parseNumeric(val);
      } else {
        obj[key] = String(val ?? "").trim();
      }
    });
    // Fill defaults
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

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // ── Template download ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      ["BRG001", "Helm Racing Full Face", "Arai", "PT Sumber Motor", 1200000, 1750000],
      ["BRG002", "Sarung Tangan Balap", "Alpinestars", "PT Sumber Motor", 350000, 550000],
    ]);
    ws["!cols"] = TEMPLATE_COLUMNS.map((_, i) => ({ wch: i === 1 ? 35 : 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Barang");
    XLSX.writeFile(wb, "template_master_barang.xlsx");
    toast({ title: "Template berhasil didownload" });
  };

  // ── File import ────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const items = parseRowsToItems(rows);
        if (!items.length) {
          toast({ title: "File kosong atau format tidak sesuai", variant: "destructive" });
          return;
        }
        setPreviewItems(items);
        setImportResult(null);
      } catch {
        toast({ title: "Gagal membaca file Excel", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  // ── Paste import ───────────────────────────────────────────────────────────
  const parsePaste = () => {
    const lines = pasteText.trim().split("\n").filter(l => l.trim());
    if (!lines.length) { toast({ title: "Data kosong", variant: "destructive" }); return; }
    
    // Split by tab or semicolon (common in different locales)
    const rows: any[][] = lines.map(l => {
      if (l.includes("\t")) return l.split("\t").map(c => c.trim());
      if (l.includes(";")) return l.split(";").map(c => c.trim());
      return [l.trim()]; // fallback
    });

    const items = parseRowsToItems(rows);
    
    if (!items.length) { 
      toast({ title: "Tidak ada data valid", description: "Pastikan format kolom sesuai: Kode, Nama, Brand, Supplier, Harga Beli, Harga Jual", variant: "destructive" }); 
      return; 
    }
    setPreviewItems(items);
    setImportResult(null);
  };

  // ── Bulk save ──────────────────────────────────────────────────────────────
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
      
      const contentType = res.headers.get("content-type");
      let result: any = {};
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 413) {
          throw new Error("Ukuran data terlalu besar. Silakan bagi file Excel Anda menjadi beberapa bagian (misal: per 1000 baris).");
        }
        throw new Error(`Server memberikan respons tak terduga (Error ${res.status}). Silakan coba lagi nanti.`);
      }
      
      if (!res.ok) {
        throw new Error(result.error || result.message || "Gagal menyimpan data ke server");
      }
      
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/master-barang"] });
      if (result.inserted + result.updated > 0) {
        toast({ title: `Import selesai: ${result.inserted} ditambah, ${result.updated} diupdate` });
      }
    } catch (err: any) {
      console.error("Bulk import error:", err);
      toast({ 
        title: "Import gagal", 
        description: err.message || "Terjadi kesalahan saat menghubungi server",
        variant: "destructive" 
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setPreviewItems([]);
    setImportResult(null);
    setPasteText("");
  };

  const handleDeleteAll = async () => {
    if (!confirm("PERINGATAN: Anda akan menghapus SELURUH data barang. Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin?")) return;
    if (!confirm("KONFIRMASI TERAKHIR: Hapus semua data barang sekarang?")) return;

    try {
      const res = await fetch("/api/master-barang/all", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal menghapus data");
      
      toast({ title: "Berhasil", description: "Semua data barang telah dihapus." });
      queryClient.invalidateQueries({ queryKey: ["/api/master-barang"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredData = data?.filter(item =>
    item.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
    item.kodeBarang.toLowerCase().includes(search.toLowerCase()) ||
    item.brand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Package className="text-primary w-8 h-8" /> Master Barang
        </h1>
        <div className="flex gap-2">
          {canDelete && (
            <button onClick={handleDeleteAll} className="flex items-center gap-2 px-4 py-2 bg-destructive/20 border border-destructive/40 text-destructive rounded-lg text-sm hover:bg-destructive/30 transition-colors">
              <Trash2 className="w-4 h-4" /> Hapus Semua
            </button>
          )}
          {canExport && (
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 rounded-lg text-sm hover:bg-emerald-600/30 transition-colors">
              <Download className="w-4 h-4" /> Download Template
            </button>
          )}
          {canAdd && (
            <button onClick={() => { setShowImport(v => !v); resetImport(); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-600/40 text-blue-400 rounded-lg text-sm hover:bg-blue-600/30 transition-colors">
              <Upload className="w-4 h-4" /> Import Data
            </button>
          )}
        </div>
      </div>

      {/* ── Import Panel ── */}
      {showImport && canAdd && (
        <Card className="mb-6 border-blue-500/30">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base text-blue-400 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Import Master Barang
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-secondary/50 p-1 rounded-lg w-fit">
              <button onClick={() => { setImportTab("file"); resetImport(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors ${importTab === "file" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Upload className="w-3.5 h-3.5" /> Upload File Excel
              </button>
              <button onClick={() => { setImportTab("paste"); resetImport(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors ${importTab === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <ClipboardPaste className="w-3.5 h-3.5" /> Copy-Paste dari Excel
              </button>
            </div>

            {importTab === "file" && !previewItems.length && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload file Excel (.xlsx/.xls) dengan kolom: <span className="text-foreground font-medium">Kode Barang, Nama Barang, Brand, Supplier, Harga Beli, Harga Jual</span>
                </p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-blue-500/40 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400/70 hover:bg-blue-500/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-sm text-blue-300 font-medium">Klik untuk pilih file Excel</p>
                  <p className="text-sm text-muted-foreground mt-1">.xlsx atau .xls</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              </div>
            )}

            {importTab === "paste" && !previewItems.length && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Salin data dari Excel (Ctrl+C), lalu paste di sini. Urutan kolom: <span className="text-foreground font-medium">Kode Barang | Nama Barang | Brand | Supplier | Harga Beli | Harga Jual</span>. Baris pertama boleh header atau langsung data.
                </p>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={"BRG001\tHelm Racing Full Face\tArai\tPT Sumber Motor\t1200000\t1750000\nBRG002\tSarung Tangan\tAlpinestars\tPT Maju\t350000\t550000"}
                  className="w-full h-40 bg-background border border-border rounded-lg p-3 text-sm font-mono outline-none focus:border-blue-400 resize-none"
                />
                <button onClick={parsePaste} className="mt-2 px-4 py-2 bg-blue-600/30 border border-blue-500/50 text-blue-300 rounded-lg text-sm hover:bg-blue-600/40 transition-colors">
                  Preview Data
                </button>
              </div>
            )}

            {/* Preview Table */}
            {previewItems.length > 0 && !importResult && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">{previewItems.length} baris siap diimport</p>
                  <button onClick={resetImport} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3 h-3" /> Reset
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/50 mb-4 max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-muted-foreground uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Kode</th>
                        <th className="px-3 py-2 text-left">Nama Barang</th>
                        <th className="px-3 py-2 text-left">Brand</th>
                        <th className="px-3 py-2 text-left">Supplier</th>
                        <th className="px-3 py-2 text-right">Harga Beli</th>
                        <th className="px-3 py-2 text-right">Harga Jual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.map((item, i) => (
                        <tr key={i} className="border-t border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-1.5 font-mono">{item.kodeBarang}</td>
                          <td className="px-3 py-1.5">{item.namaBarang}</td>
                          <td className="px-3 py-1.5 text-primary">{item.brand}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{item.supplier}</td>
                          <td className="px-3 py-1.5 text-right">{Number(item.hargaBeli).toLocaleString("id-ID")}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-400">{Number(item.hargaJual).toLocaleString("id-ID")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBulkImport} disabled={importing} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60">
                    {importing ? "Mengimport..." : `Import ${previewItems.length} Data`}
                  </button>
                  <button onClick={resetImport} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground">Batal</button>
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold">Import Selesai!</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="bg-secondary/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{importResult.inserted}</div>
                    <div className="text-sm text-muted-foreground">Barang baru ditambahkan</div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{importResult.updated}</div>
                    <div className="text-sm text-muted-foreground">Barang diupdate</div>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-destructive flex items-center gap-1 mb-1"><AlertCircle className="w-3 h-3" /> {importResult.errors.length} baris dilewati:</p>
                    {importResult.errors.map((e, i) => <p key={i} className="text-sm text-muted-foreground pl-4">• {e}</p>)}
                  </div>
                )}
                <button onClick={() => { resetImport(); setShowImport(false); }} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90">
                  Tutup
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Add / Edit Form ── */}
      {(canAdd || (canEdit && editingId)) && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base">{editingId ? "Edit Barang" : "Tambah Barang"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Kode Barang *</label>
                <input type="text" required value={form.kodeBarang} onChange={e => setForm({ ...form, kodeBarang: e.target.value })} placeholder="BRG001" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="xl:col-span-2">
                <label className="text-sm text-muted-foreground block mb-1">Nama Barang *</label>
                <input type="text" required value={form.namaBarang} onChange={e => setForm({ ...form, namaBarang: e.target.value })} placeholder="Helm Racing Full Face" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Brand *</label>
                <input type="text" required value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Arai" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Supplier</label>
                <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="PT Sumber Motor" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Harga Beli *</label>
                <input type="number" required min="0" value={form.hargaBeli} onChange={e => setForm({ ...form, hargaBeli: e.target.value })} placeholder="1200000" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Harga Jual *</label>
                <input type="number" required min="0" value={form.hargaJual} onChange={e => setForm({ ...form, hargaJual: e.target.value })} placeholder="1750000" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="xl:col-span-3 flex justify-end gap-2 pt-2 border-t border-border/30">
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); setForm({ kodeBarang: "", namaBarang: "", brand: "", supplier: "", hargaBeli: "", hargaJual: "" }); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary/50">
                    Batal
                  </button>
                )}
                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90">
                  <Plus className="w-4 h-4" /> {editingId ? "Update Barang" : "Simpan Barang"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Product Table ── */}
      <Card>
        <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Daftar Barang ({filteredData?.length ?? 0})</CardTitle>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Cari barang..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-full text-sm outline-none focus:border-primary w-64" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-sm text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-black tracking-widest uppercase">Kode</th>
                  <th className="px-4 py-3 font-black tracking-widest uppercase">Nama Barang</th>
                  <th className="px-4 py-3 font-black tracking-widest uppercase">Brand</th>
                  <th className="px-4 py-3 font-black tracking-widest uppercase text-right">Harga Jual</th>
                  <th className="px-4 py-3 text-center font-black tracking-widest uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground italic">Memuat...</td></tr>
                ) : !filteredData?.length ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground font-black uppercase">Belum ada data barang</td></tr>
                ) : filteredData.map(item => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-primary/[0.02] transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs font-medium tracking-tight text-muted-foreground">{item.kodeBarang}</td>
                    <td className="px-4 py-3 font-black text-foreground">{item.namaBarang}</td>
                    <td className="px-4 py-3"><span className="text-xs font-medium tracking-tight bg-primary/10 text-primary px-2 py-0.5 rounded font-black uppercase tracking-wider">{item.brand}</span></td>
                    <td className="px-4 py-3 text-right font-black text-emerald-500">{formatRupiah(item.hargaJual)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 border border-blue-500/20"><Edit2 className="w-4 h-4"/></button>}
                        {canDelete && <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-rose-500/20"><Trash2 className="w-4 h-4"/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-border/20 p-2">
            {isLoading ? (
              <div className="p-10 text-center text-muted-foreground animate-pulse italic">Memuat...</div>
            ) : !filteredData?.length ? (
              <div className="p-10 text-center text-muted-foreground">Tidak ada data.</div>
            ) : filteredData.map(item => (
              <div key={item.id} className="p-4 bg-card/60 my-2 rounded-xl border border-border/20 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs italic tracking-tighter font-mono text-muted-foreground uppercase">{item.kodeBarang}</div>
                    <div className="text-sm font-black text-foreground mt-0.5">{item.namaBarang}</div>
                  </div>
                  <span className="text-xs font-bold leading-none bg-primary/10 text-primary px-2 py-0.5 rounded font-black uppercase tracking-widest">{item.brand}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <div className="text-sm font-black text-emerald-500">{formatRupiah(item.hargaJual)}</div>
                  <div className="flex gap-2">
                    {canEdit && <button onClick={() => handleEdit(item)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10 border border-blue-500/10"><Edit2 className="w-4 h-4"/></button>}
                    {canDelete && <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-rose-500/10"><Trash2 className="w-4 h-4"/></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
