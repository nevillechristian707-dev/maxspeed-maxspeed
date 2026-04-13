import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileText, Download } from "lucide-react";
import { useListKodePencairan, listTransaksiBank } from "@workspace/api-client-react";
import { formatRupiah, formatDate } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface CetakPencairanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateParams: { startDate?: string; endDate?: string };
}

export function CetakPencairanModal({ open, onOpenChange, dateParams }: CetakPencairanModalProps) {
  const { data: kodePencairanList, isLoading } = useListKodePencairan(dateParams);
  const [selectedKode, setSelectedKode] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handlePrintPDF = async () => {
    if (!selectedKode) return;
    setIsExporting(true);
    try {
      const summary = kodePencairanList?.find(k => k.kodePencairan === selectedKode);
      const data = await listTransaksiBank({ kodePencairan: selectedKode });

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("LAPORAN PENCAIRAN", pageWidth / 2, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Kode Pencairan: ${selectedKode}`, 14, 25);
      doc.text(`Tanggal Cetak: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 25, { align: "right" });
      
      if (summary) {
        doc.text(`Bank Tujuan: ${summary.namaBank} (${summary.rekeningBank})`, 14, 31);
        doc.text(`Total Pencairan: ${formatRupiah(summary.totalNilai)}`, 14, 37);
      }

      // Table Content
      const tableColumn = ["No", "Tanggal", "No Faktur", "Transaksi", "Produk/Customer", "Nilai (Rp)"];
      const tableRows = data.map((item, index) => [
        (index + 1).toString(),
        formatDate(item.tanggalCair),
        item.noFaktur || "-",
        `${item.kodeTransaksi || ""}\n${item.sumber.toUpperCase()}`,
        `${item.namaBarang || ""}\n${item.namaCustomer || item.namaOnlineShop || ""}`,
        formatRupiah(item.nilai)
      ]);

      autoTable(doc, {
        startY: 45,
        head: [tableColumn],
        body: tableRows,
        foot: [
          [{ content: 'TOTAL KESELURUHAN', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } as any }, formatRupiah(summary?.totalNilai || 0)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [46, 204, 113], textColor: 255, halign: 'center' },
        footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
          4: { cellWidth: 50 },
          5: { halign: 'right' }
        },
        styles: { fontSize: 8, cellPadding: 2 },
      });

      doc.save(`Laporan_Pencairan_${selectedKode}.pdf`);
      toast({ title: "Berhasil", description: "Laporan PDF berhasil diunduh." });
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat membuat PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintExcel = async () => {
    if (!selectedKode) return;
    setIsExporting(true);
    try {
      const summary = kodePencairanList?.find(k => k.kodePencairan === selectedKode);
      const data = await listTransaksiBank({ kodePencairan: selectedKode });

      const wsData = [
        ["LAPORAN PENCAIRAN " + selectedKode],
        ["Tanggal Cetak", formatDate(new Date().toISOString())],
        ["Bank Tujuan", summary ? `${summary.namaBank} (${summary.rekeningBank})` : ""],
        ["Total Pencairan", summary ? formatRupiah(summary.totalNilai) : ""],
        [],
        ["No", "Tanggal Cair", "No Faktur", "ID Transaksi", "Sumber", "Produk", "Customer/OS", "Bank", "Rekening", "Nilai (Rp)"]
      ];

      data.forEach((item, index) => {
        wsData.push([
          (index + 1).toString(),
          formatDate(item.tanggalCair),
          item.noFaktur || "-",
          item.kodeTransaksi || "-",
          item.sumber,
          item.namaBarang || "-",
          item.namaCustomer || item.namaOnlineShop || "-",
          item.namaBank,
          item.rekeningBank,
          item.nilai.toString()
        ]);
      });

      wsData.push([]);
      wsData.push([
        "", "", "", "", "", "", "", "",
        "TOTAL KESELURUHAN",
        summary ? summary.totalNilai.toString() : "0"
      ]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Basic styling for the worksheet (column widths)
      ws['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan_Pencairan");
      XLSX.writeFile(wb, `Laporan_Pencairan_${selectedKode}.xlsx`);
      toast({ title: "Berhasil", description: "Laporan Excel berhasil diunduh." });
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat membuat Excel.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Open PDF in a new window/tab for "Layar"
  const handlePrintLayar = async () => {
    if (!selectedKode) return;
    setIsExporting(true);
    try {
      const summary = kodePencairanList?.find(k => k.kodePencairan === selectedKode);
      const data = await listTransaksiBank({ kodePencairan: selectedKode });

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("LAPORAN PENCAIRAN", pageWidth / 2, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Kode Pencairan: ${selectedKode}`, 14, 25);
      doc.text(`Tanggal Cetak: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 25, { align: "right" });
      
      if (summary) {
        doc.text(`Bank Tujuan: ${summary.namaBank} (${summary.rekeningBank})`, 14, 31);
        doc.text(`Total Pencairan: ${formatRupiah(summary.totalNilai)}`, 14, 37);
      }

      const tableColumn = ["No", "Tanggal", "No Faktur", "Transaksi", "Produk/Customer", "Nilai (Rp)"];
      const tableRows = data.map((item, index) => [
        (index + 1).toString(),
        formatDate(item.tanggalCair),
        item.noFaktur || "-",
        `${item.kodeTransaksi || ""}\n${item.sumber.toUpperCase()}`,
        `${item.namaBarang || ""}\n${item.namaCustomer || item.namaOnlineShop || ""}`,
        formatRupiah(item.nilai)
      ]);

      autoTable(doc, {
        startY: 45,
        head: [tableColumn],
        body: tableRows,
        foot: [
          [{ content: 'TOTAL KESELURUHAN', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } as any }, formatRupiah(summary?.totalNilai || 0)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [46, 204, 113], textColor: 255, halign: 'center' },
        footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
          4: { cellWidth: 50 },
          5: { halign: 'right' }
        },
        styles: { fontSize: 8, cellPadding: 2 },
      });

      // Output to blob and open in new window
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke the URL after a delay to ensure it loads
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat memuat tampilan.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Cetak Laporan Pencairan
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Pilih Kode Pencairan</label>
              <Select value={selectedKode} onValueChange={setSelectedKode}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kode pencairan..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">Memuat...</div>
                  ) : !kodePencairanList || kodePencairanList.length === 0 ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">Tidak ada riwayat.</div>
                  ) : (
                    kodePencairanList.map((k) => (
                      <SelectItem key={k.kodePencairan} value={k.kodePencairan}>
                        {k.kodePencairan} - {formatDate(k.tanggalCair)} ({formatRupiah(k.totalNilai)})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedKode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border/50">
                <Button 
                  onClick={handlePrintLayar}
                  disabled={isExporting}
                  variant="outline" 
                  className="w-full justify-start border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Tampilkan Layar
                </Button>
                
                <Button 
                  onClick={handlePrintPDF}
                  disabled={isExporting}
                  variant="outline" 
                  className="w-full justify-start border-red-500/30 text-red-600 hover:bg-red-500/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Print PDF
                </Button>

                <Button 
                  onClick={handlePrintExcel}
                  disabled={isExporting}
                  variant="outline" 
                  className="w-full justify-start sm:col-span-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            )}
            
            {isExporting && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                    Memproses laporan...
                </div>
            )}
          </div>
        </div>

        <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
