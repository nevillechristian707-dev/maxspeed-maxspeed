import { useGetLaporanProfit, useGetTopProducts, useListPenjualan, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatRupiah, getIndonesianPeriodLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as ChartIcon, Trophy, FileDown, FileText, Printer, ShoppingCart, DollarSign, Landmark, Store, CreditCard, ChevronDown, DownloadCloud, Monitor } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMonthYear } from "@/context/month-year-context";
import { useState, useMemo, useEffect, useRef } from "react";

export default function Laporan() {
  const { dateParams, selectedYear, selectedMonth } = useMonthYear();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPreview, setIsPreview] = useState(false);

  const { data: profit, isLoading: loadingProfit } = useGetLaporanProfit(dateParams);
  const { data: topProducts, isLoading: loadingTop } = useGetTopProducts({ limit: 10, ...dateParams });
  const { data: allSales, isLoading: loadingSales } = useListPenjualan(dateParams);
  const { data: user } = useGetMe();

  const canExport = (() => {
    const role = user?.role?.toLowerCase() || '';
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions['Laporan'] || permissions['laporan'] || [];
    return perms.some((p: string) => p.toLowerCase() === 'export');
  })();

  const salesByCategory = useMemo(() => {
    if (!allSales) return { cash: [], bank: [], online_shop: [], kredit: [] };
    return {
      cash: allSales.filter(s => s.paymentMethod === 'cash'),
      bank: allSales.filter(s => s.paymentMethod === 'bank'),
      online_shop: allSales.filter(s => s.paymentMethod === 'online_shop'),
      kredit: allSales.filter(s => s.paymentMethod === 'kredit'),
    };
  }, [allSales]);

  const allStats = useMemo(() => {
    if (!allSales) return { omzet: 0, modal: 0, profit: 0 };
    const omzet = allSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const modal = allSales.reduce((acc, curr) => acc + ((curr.hargaBeli || 0) * (curr.qty || 0)), 0);
    return { omzet, modal, profit: omzet - modal };
  }, [allSales]);

  const exportExcel = () => {
    if (!profit || !allStats) return;
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Ringkasan Performa
    const summaryData = [
      ["REKAPITULASI LAPORAN LABA RUGI"],
      ["Periode", getIndonesianPeriodLabel(selectedMonth, selectedYear)],
      [],
      ["1. PERFORMA KESELURUHAN (CAIR + PENDING)"],
      ["Total Omzet", allStats.omzet],
      ["Total Modal Pokok", allStats.modal],
      ["Potensi Laba Kotor", allStats.profit],
      [],
      ["2. REALITAS KAS (HANYA LUNAS/CAIR)"],
      ["Omzet Cair", profit.totalPenjualan],
      ["Modal Cair", profit.totalModal],
      ["Beban Operasional", profit.totalBiaya],
      ["LABA BERSIH", profit.laba],
      ["Alokasi Laba (10%)", profit.labaShared]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

    // Sheet 2: Top Produk
    if (topProducts) {
      const wsTop = XLSX.utils.json_to_sheet(topProducts.map(p => ({
        'Kode': p.kodeBarang,
        'Nama Produk': p.namaBarang,
        'Brand': p.brand,
        'Qty Terjual': p.totalQty,
        'Total Penjualan': p.totalPenjualan
      })));
      XLSX.utils.book_append_sheet(wb, wsTop, "Top Produk");
    }

    // Sheet 3: Seluruh Rincian Penjualan
    if (allSales) {
      const wsDetails = XLSX.utils.json_to_sheet(allSales.map(s => ({
        'Tanggal': s.tanggal,
        'No Faktur': s.noFaktur || s.id,
        'Kode Barang': s.kodeBarang,
        'Nama Barang': s.namaBarang,
        'Qty': s.qty,
        'Metode Bayar': s.paymentMethod.toUpperCase(),
        'Harga Beli': s.hargaBeli,
        'Modal Total': (s.hargaBeli || 0) * (s.qty || 0),
        'Harga Jual': s.total,
        'Laba/Rugi': (s.total || 0) - ((s.hargaBeli || 0) * (s.qty || 0)),
        'Status': s.statusCair === 'cair' ? 'LUNAS' : 'PENDING'
      })));
      XLSX.utils.book_append_sheet(wb, wsDetails, "Rincian Transaksi");
    }

    const filename = `Laporan_MaxSpeed_${selectedMonth}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportPDF = () => {
    if (!profit || !allStats || !topProducts) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const periodStr = getIndonesianPeriodLabel(selectedMonth, selectedYear);
    
    // Page 1: Strategic Summary
    // Header
    doc.setFontSize(22);
    doc.setTextColor(234, 88, 12); // Orange-600
    doc.text("MAX SPEED RACING SHOP", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Laporan Keuangan Strategis & Performa", 105, 28, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Periode: ${periodStr}`, 105, 34, { align: 'center' });
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    // Section 1: Rekap Penjualan
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text("I. RINGKASAN PENJUALAN", 14, 48);
    autoTable(doc, {
      startY: 52,
      head: [['Keterangan', 'Nilai (IDR)']],
      body: [
        ['Total Omzet (Cair + Pending)', formatRupiah(allStats.omzet)],
        ['Total Modal Pokok', formatRupiah(allStats.modal)],
        ['Potensi Keuntungan', formatRupiah(allStats.profit)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 }
    });

    // Section 2: Laba Rugi Realitas
    doc.text("II. LABA RUGI REALITAS (LUNAS)", 14, (doc as any).lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 13,
      head: [['Keterangan Realitas', 'Nilai (IDR)']],
      body: [
        ['Omzet Cair', formatRupiah(profit.totalPenjualan)],
        ['Modal Cair', formatRupiah(profit.totalModal)],
        ['Beban Operasional', formatRupiah(profit.totalBiaya)],
        ['LABA BERSIH AKHIR', formatRupiah(profit.laba)],
        ['Alokasi Laba (10%)', formatRupiah(profit.labaShared)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
      didParseCell: function(data) {
        if (data.row.index === 3) {
          data.cell.styles.fillColor = [234, 88, 12];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontSize = 10;
        }
        if (data.row.index === 4) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [71, 85, 105];
          data.cell.styles.fontStyle = 'italic';
        }
      }
    });

    // Section 3: Top Performance
    doc.text("III. TOP PERFORMANCE (PERINGKAT PRODUK)", 14, (doc as any).lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 13,
      head: [['Rank', 'Nama Produk', 'Brand', 'Total Penjualan']],
      body: topProducts.slice(0, 10).map((p, i) => [
        i + 1,
        p.namaBarang,
        p.brand,
        formatRupiah(p.totalPenjualan)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { halign: 'center' }, 3: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 }
    });

    // Page Footer for Page 1
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Dicetak otomatis oleh Sistem Dashboard Max Speed", 14, 285);
    doc.text("Halaman 1", 196, 285, { align: 'right' });

    // PAGE BREAK - NEW PAGE FOR DETAILS
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text("IV. RINCIAN PENJUALAN PER METODE BAYAR", 14, 20);
    doc.setDrawColor(234, 88, 12);
    doc.line(14, 22, 196, 22);
    
    let currentY = 30;
    const categories = [
      { label: 'CASH (TUNAI)', data: salesByCategory.cash },
      { label: 'BANK (TRANSFER)', data: salesByCategory.bank },
      { label: 'ONLINE SHOP', data: salesByCategory.online_shop },
      { label: 'KREDIT (TEMPO)', data: salesByCategory.kredit }
    ];

    categories.forEach((cat) => {
      if (cat.data.length > 0) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(10);
        doc.setTextColor(234, 88, 12);
        doc.text(`Kategori: ${cat.label}`, 14, currentY);
        
        autoTable(doc, {
          startY: currentY + 3,
          head: [['TGL', 'Faktur', 'Produk', 'Qty', 'Modal', 'Jual', 'Laba', 'Status']],
          body: cat.data.map(s => [
            s.tanggal,
            s.noFaktur || '-',
            s.namaBarang,
            s.qty,
            formatRupiah((s.hargaBeli || 0) * (s.qty || 0)),
            formatRupiah(s.total),
            formatRupiah((s.total || 0) - ((s.hargaBeli || 0) * (s.qty || 0))),
            s.statusCair === 'cair' ? 'LUNAS' : 'PEND'
          ]),
          styles: { fontSize: 6.5, cellPadding: 2 },
          headStyles: { fillColor: [30, 41, 59] },
          columnStyles: { 
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right', fontStyle: 'bold' },
            7: { halign: 'center' }
          },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Halaman ${doc.getNumberOfPages()}`, 196, 285, { align: 'right' });
          }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    const filename = `Laporan_MaxSpeed_Keuangan_${selectedMonth}_${selectedYear}.pdf`;
    doc.save(filename);
  };

  const handlePrint = () => {
    setIsPreview(true);
  };

  if (loadingProfit || loadingTop || loadingSales) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #preview-overlay, #preview-overlay * { visibility: visible !important; }
          #preview-overlay { 
            position: fixed !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; display: block; height: 0; }
          @page { margin: 10mm; size: A4; }
          .report-paper { 
            box-shadow: none !important; 
            margin: 0 !important; 
            width: 100% !important; 
            padding: 0 !important;
          }
          .report-page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            margin: 0 auto;
            background: white !important;
            page-break-after: always;
            box-sizing: border-box;
          }
          .report-page:last-child { page-break-after: auto; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 8pt; }
          th, td { border: 1px solid #94a3b8 !important; padding: 4px !important; }
          .bg-primary { background-color: #ea580c !important; -webkit-print-color-adjust: exact; color: white !important; }
        }

        .report-paper {
          background: #334155;
          padding: 40px 0;
          display: flex;
          flex-direction: column;
          gap: 40px;
          align-items: center;
        }
        
        .report-page {
          background: white;
          color: black;
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          position: relative;
        }

        .report-page h3 {
          color: #ea580c;
          border-bottom: 2px solid #ea580c;
          padding-bottom: 4px;
          margin-bottom: 16px;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 11px;
        }

        .report-page table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 10px;
        }
        
        .report-page th { background: #1e293b; color: white; padding: 8px; text-align: left; }
        .report-page td { border: 1px solid #e2e8f0; padding: 8px; }
      `}</style>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 no-print">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <ChartIcon className="text-primary" /> Laporan Laba Rugi
          </h1>
          <p className="text-muted-foreground mt-1">Laporan finansial strategis Max Speed.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-6 shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                  <DownloadCloud className="w-5 h-5" /> EKSPOR LAPORAN <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 bg-card border-primary/20 backdrop-blur-xl shadow-2xl">
                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pilih Format Output</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/10" />
                
                <DropdownMenuItem onClick={handlePrint} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/5 rounded-lg group">
                  <div className="p-2 rounded-md bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-tight">Tampilan Layar</span>
                    <span className="text-[9px] text-muted-foreground">Cetak ke Printer / PDF Browser</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={exportExcel} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-emerald-500/5 rounded-lg group">
                  <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                    <FileDown className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-tight">Data Excel (.xlsx)</span>
                    <span className="text-[9px] text-muted-foreground">Rincian data untuk audit & olah data</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={exportPDF} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-rose-500/5 rounded-lg group">
                  <div className="p-2 rounded-md bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-tight">Dokumen PDF (.pdf)</span>
                    <span className="text-[9px] text-muted-foreground">Arsip laporan resmi bulanan</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* MAIN VIEW */}
      <div id="printable-area" className={isPreview ? "hidden" : ""}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12 page-break">
          {/* Summary Card 1: All Sales Recap */}
          <Card className="border-primary/20 bg-background/40 backdrop-blur-md relative overflow-hidden shadow-xl card group hover:border-primary/40 transition-all">
            <div className="absolute top-0 right-0 p-12 bg-primary/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-primary/10 transition-colors" />
            <CardHeader className="border-b border-border/50 pb-3 relative z-10">
              <CardTitle className="text-lg font-display uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" /> Rekap Penjualan
              </CardTitle>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">Perolehan Kotor (Cair + Pending)</p>
            </CardHeader>
            <CardContent className="space-y-4 py-6 relative z-10">
              <div className="flex justify-between items-center bg-secondary/10 p-4 rounded-xl border border-white/5">
                <span className="text-muted-foreground text-[10px] uppercase font-black">Total Omzet</span>
                <span className="font-black text-xl text-foreground tracking-tight">{formatRupiah(allStats.omzet)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-muted-foreground text-[10px] uppercase font-bold">Total Modal</span>
                <span className="font-bold text-orange-400/80">{formatRupiah(allStats.modal)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 shadow-inner">
                <span className="text-emerald-500 text-[10px] font-black uppercase italic">Potensi Keuntungan</span>
                <span className="text-xl font-black text-emerald-400 tracking-tight">{formatRupiah(allStats.profit)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Summary Card 2: Profit Calculation (Settled Only) */}
          <Card className="border-primary/30 shadow-2xl shadow-primary/5 bg-gradient-to-br from-card to-background relative overflow-hidden ring-1 ring-primary/20 card group hover:shadow-primary/10 transition-all">
            <div className="absolute top-0 right-0 p-16 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-colors" />
            <CardHeader className="border-b border-border/50 pb-3 relative z-10">
              <CardTitle className="text-lg font-display uppercase tracking-widest flex items-center gap-2 text-primary">
                <ChartIcon className="w-5 h-5" /> Laba Rugi Realitas
              </CardTitle>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">Khusus Transaksi yang Sudah Lunas</p>
            </CardHeader>
            <CardContent className="space-y-4 py-6 relative z-10">
              <div className="flex justify-between items-center px-4 py-2 bg-background/50 rounded-lg border border-white/5">
                <span className="text-muted-foreground text-[10px] uppercase font-bold">Omzet Cair</span>
                <span className="font-black text-foreground tracking-tight">{formatRupiah(profit?.totalPenjualan)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-muted-foreground text-[10px] uppercase font-bold">Modal Cair</span>
                <span className="font-bold text-orange-400/80">- {formatRupiah(profit?.totalModal)}</span>
              </div>
              <div className="flex justify-between items-center px-2 border-b border-border/50 pb-2">
                <span className="text-muted-foreground text-[10px] uppercase font-bold">Beban Operasional</span>
                <span className="font-bold text-rose-400/80">- {formatRupiah(profit?.totalBiaya)}</span>
              </div>
              <div className="flex justify-between items-center bg-primary p-4 rounded-xl shadow-lg shadow-primary/30 transform active:scale-95 transition-transform">
                <span className="text-primary-foreground text-xs font-black uppercase tracking-wider">LABA BERSIH</span>
                <span className="text-2xl font-black text-primary-foreground tracking-tight">{formatRupiah(profit?.laba)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-secondary/20 rounded-xl border border-border/50">
                <span className="text-muted-foreground text-[10px] uppercase font-black italic">Alokasi Laba (10%)</span>
                <span className="font-black text-foreground tracking-tight underline decoration-primary decoration-2 underline-offset-4">{formatRupiah(profit?.labaShared)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Summary Card 3: Top 10 Products */}
          <Card className="h-full border-border/40 bg-background/20 backdrop-blur-sm card overflow-hidden flex flex-col">
            <CardHeader className="border-b border-border/50 bg-secondary/10 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-black"><Trophy className="w-4 h-4 text-yellow-500"/> Top Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/40 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-black tracking-widest">Produk</th>
                    <th className="px-4 py-3 text-right font-black tracking-widest">Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {topProducts?.slice(0, 10).map((p, i) => (
                    <tr key={i} className="hover:bg-primary/[0.03] transition-colors group/row">
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${i < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</span>
                        <div>
                          <div className="font-bold text-[11px] text-foreground mb-0.5">{p.namaBarang}</div>
                          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-tighter">{p.brand}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400 text-[11px] tabular-nums">{formatRupiah(p.totalPenjualan)}</td>
                    </tr>
                  ))}
                  {(!topProducts || topProducts.length === 0) && (
                    <tr><td colSpan={2} className="text-center py-12 text-muted-foreground italic">Belum ada data produk terjual</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8 mt-12 pb-20">
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-3 border-l-4 border-primary pl-4 uppercase tracking-tighter">
            <ShoppingCart className="text-primary w-6 h-6" /> Rincian Penjualan per Metode Pembayaran
          </h2>

          <div className="grid grid-cols-1 gap-10">
            {[
              { id: 'cash', label: 'Penjualan Tunai / Cash', icon: DollarSign, color: 'emerald', data: salesByCategory.cash },
              { id: 'bank', label: 'Transfer Bank / Debit', icon: Landmark, color: 'blue', data: salesByCategory.bank },
              { id: 'online_shop', label: 'Online Shop / Marketplace', icon: Store, color: 'purple', data: salesByCategory.online_shop },
              { id: 'kredit', label: 'Penjualan Kredit / Tempo', icon: CreditCard, color: 'orange', data: salesByCategory.kredit }
            ].map((cat) => ( cat.data.length > 0 && 
              <Card key={cat.id} className="border-border/40 shadow-2xl overflow-hidden bg-card/40 backdrop-blur-md transition-all hover:border-primary/20 card">
                <CardHeader className="bg-secondary/10 border-b border-border/50 py-4">
                  <CardTitle className="flex items-center gap-3 text-lg uppercase tracking-tight font-black">
                    <div className={`p-2.5 rounded-xl bg-${cat.color}-500/10 border border-${cat.color}-500/20 shadow-inner`}>
                      <cat.icon className={`w-5 h-5 text-${cat.color}-400`} />
                    </div>
                    {cat.label}
                    <span className="ml-auto text-[10px] bg-secondary/50 px-3 py-1 rounded-full text-muted-foreground font-black tracking-widest">{cat.data.length} TRX</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-[12px] text-left border-collapse">
                      <thead className="bg-secondary/40 text-muted-foreground uppercase text-[9px] tracking-widest font-black border-b border-border/50">
                        <tr>
                          <th className="px-6 py-4">Tanggal</th>
                          <th className="px-4 py-4">No. Faktur</th>
                          <th className="px-4 py-4">Nama Produk</th>
                          <th className="px-4 py-4 text-center">Qty</th>
                          <th className="px-4 py-4 text-right">Modal Pokok</th>
                          <th className="px-4 py-4 text-right">Harga Jual</th>
                          <th className="px-4 py-4 text-right">Margin/Laba</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/10">
                        {cat.data.map((s: any) => {
                          const m = (s.hargaBeli || 0) * (s.qty || 0);
                          const j = s.total || 0;
                          const l = j - m;
                          return (
                            <tr key={s.id} className="hover:bg-primary/[0.03] transition-colors group/row">
                              <td className="px-6 py-4 whitespace-nowrap text-muted-foreground/80 font-medium">{s.tanggal}</td>
                              <td className="px-4 py-4 font-black text-foreground tracking-tighter">{s.noFaktur || '-'}</td>
                              <td className="px-4 py-4 min-w-[200px]">
                                <div className="font-bold text-foreground leading-snug group-hover/row:text-primary transition-colors">{s.namaBarang}</div>
                                <div className="text-[9px] text-muted-foreground/60 font-mono tracking-tighter uppercase mt-0.5">{s.kodeBarang}</div>
                              </td>
                              <td className="px-4 py-4 text-center font-black text-foreground tabular-nums">{s.qty}</td>
                              <td className="px-4 py-4 text-right text-muted-foreground italic font-medium tabular-nums">{formatRupiah(m)}</td>
                              <td className="px-4 py-4 text-right font-black text-foreground tabular-nums">{formatRupiah(j)}</td>
                              <td className={`px-4 py-4 text-right font-black text-sm tabular-nums ${l >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <span className="flex items-center justify-end gap-1">
                                  {l >= 0 ? '+' : ''}{formatRupiah(l)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm border ${s.statusCair === 'cair' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                                  {s.statusCair === 'cair' ? 'Lunas' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden divide-y divide-border/20 p-2">
                    {cat.data.map((s: any) => {
                      const m = (s.hargaBeli || 0) * (s.qty || 0);
                      const j = s.total || 0;
                      const l = j - m;
                      return (
                        <div key={s.id} className="p-4 bg-card/60 my-2 rounded-xl border border-border/20 space-y-3">
                          <div className="flex justify-between items-start">
                             <div>
                               <div className="text-[10px] font-black text-primary uppercase tracking-widest">{s.tanggal}</div>
                               <div className="text-xs font-black text-foreground mt-0.5">{s.noFaktur || '-'}</div>
                             </div>
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${s.statusCair === 'cair' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                                {s.statusCair === 'cair' ? 'Lunas' : 'Pending'}
                             </span>
                          </div>
                          <div className="text-xs font-bold text-foreground border-l-2 border-primary/30 pl-2">{s.namaBarang}</div>
                          <div className="flex justify-between items-end pt-1">
                             <div className="space-y-1">
                               <div className="text-[9px] text-muted-foreground font-bold">Qty: {s.qty} • Jual: {formatRupiah(j)}</div>
                               <div className="text-[9px] text-muted-foreground italic">Modal: {formatRupiah(m)}</div>
                             </div>
                             <div className="text-right">
                               <div className="text-[9px] uppercase font-black text-muted-foreground tracking-tighter">Profit</div>
                               <div className={`text-sm font-black ${l >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{l >= 0 ? '+' : ''}{formatRupiah(l)}</div>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* REPORT PREVIEW MODAL */}
      {isPreview && (
        <div id="preview-overlay" className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in duration-300 no-preview-print">
          <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-white/10 no-print">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setIsPreview(false)} className="text-white border-white/20 hover:bg-white/10">
                TUTUP PREVIEW
              </Button>
              <div className="h-4 w-[1px] bg-white/20" />
              <p className="text-xs font-black uppercase text-white tracking-widest">Preview Laporan Layar (A4 Layout)</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-2">
                <DownloadCloud className="w-4 h-4" /> UNDUH PDF
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold flex items-center gap-2">
                <Printer className="w-4 h-4" /> CETAK / SIMPAN
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-slate-800/20">
            <div className="report-paper">
              {/* PAGE 1: STRATEGIC SUMMARY */}
              <div className="report-page">
                <div className="text-center border-b-2 border-slate-900 mb-6 pb-6">
                  <h1 className="text-4xl font-black text-rose-600 mb-1">MAX SPEED RACING SHOP</h1>
                  <p className="text-slate-500 uppercase tracking-[0.2em] font-medium text-[10px]">Laporan Keuangan Strategis & Performa Perusahaan</p>
                  <div className="mt-4 flex justify-center gap-3">
                     <span className="px-4 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-700">Periode: {getIndonesianPeriodLabel(selectedMonth, selectedYear)}</span>
                  </div>
                </div>

                <div className="space-y-8">
                  <section>
                    <h3>I. Ringkasan Penjualan</h3>
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left">Keterangan Aktivitas</th>
                          <th className="px-4 py-2 text-right">Nilai (IDR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Total Omzet (Cair + Pending)</td>
                          <td className="text-right font-bold">{formatRupiah(allStats.omzet)}</td>
                        </tr>
                        <tr>
                          <td>Total Modal Pokok</td>
                          <td className="text-right font-bold">{formatRupiah(allStats.modal)}</td>
                        </tr>
                        <tr className="bg-emerald-50">
                          <td className="font-bold text-emerald-700">Potensi Keuntungan</td>
                          <td className="text-right font-black text-emerald-600 border-l-2 border-emerald-200">{formatRupiah(allStats.profit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <h3>II. Laba Rugi Realitas (LUNAS)</h3>
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left">Keterangan Realitas</th>
                          <th className="px-4 py-2 text-right">Nilai (IDR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Omzet Cair</td>
                          <td className="text-right font-bold">{formatRupiah(profit?.totalPenjualan)}</td>
                        </tr>
                        <tr>
                          <td>Modal Cair</td>
                          <td className="text-right font-bold">{formatRupiah(profit?.totalModal)}</td>
                        </tr>
                        <tr>
                          <td>Beban Operasional</td>
                          <td className="text-right font-bold">{formatRupiah(profit?.totalBiaya)}</td>
                        </tr>
                        <tr className="bg-primary text-white">
                          <td className="font-black uppercase tracking-widest italic">Laba Bersih Akhir</td>
                          <td className="text-right font-black text-lg">{formatRupiah(profit?.laba)}</td>
                        </tr>
                        <tr className="bg-slate-50 italic">
                          <td className="font-bold text-slate-500">Alokasi Laba (10%)</td>
                          <td className="text-right font-black text-slate-700">{formatRupiah(profit?.labaShared)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <h3>III. Top Performance (Peringkat Produk)</h3>
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr>
                          <th className="w-12 text-center">Rank</th>
                          <th>Nama Produk / Brand</th>
                          <th className="text-right">Total Penjualan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts?.slice(0, 10).map((p, i) => (
                          <tr key={p.kodeBarang}>
                            <td className="text-center font-bold">{i + 1}</td>
                            <td>
                               <div className="font-bold">{p.namaBarang}</div>
                               <div className="text-[7px] text-slate-500 uppercase">{p.brand}</div>
                            </td>
                            <td className="text-right font-bold">{formatRupiah(p.totalPenjualan)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </div>

                <div className="mt-auto pt-8 border-t border-slate-100 text-[8px] text-slate-400 flex justify-between italic">
                   <p>Halaman 1/2 - Strategic Recap</p>
                   <p>Dicetak Pada: {new Date().toLocaleString('id-ID')}</p>
                </div>
              </div>

              {/* PAGE 2+: DETAILED BREAKDOWN */}
              <div className="report-page">
                <h3>IV. Rincian Penjualan per Metode Bayar</h3>
                <div className="space-y-8">
                  {[
                    { label: 'CASH (TUNAI)', data: salesByCategory.cash },
                    { label: 'BANK (TRANSFER)', data: salesByCategory.bank },
                    { label: 'ONLINE SHOP', data: salesByCategory.online_shop },
                    { label: 'KREDIT (TEMPO)', data: salesByCategory.kredit }
                  ].map((cat) => ( cat.data.length > 0 && 
                    <div key={cat.label} className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-100 px-3 py-1.5 text-[9px] font-black border-b border-slate-200 flex justify-between">
                         <span>KATEGORI: {cat.label}</span>
                         <span>{cat.data.length} Transaksi</span>
                      </div>
                      <table className="w-full text-[7px] mb-0">
                        <thead>
                          <tr className="bg-white">
                            <th className="p-1 border text-slate-600">TGL</th>
                            <th className="p-1 border text-slate-600">FAKTUR</th>
                            <th className="p-1 border text-slate-600">PRODUK</th>
                            <th className="p-1 border text-slate-600 text-center">QTY</th>
                            <th className="p-1 border text-slate-600 text-right">JUAL</th>
                            <th className="p-1 border text-slate-600 text-right">LABA</th>
                            <th className="p-1 border text-slate-600 text-center">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.data.map((s: any) => (
                            <tr key={s.id}>
                              <td className="p-1 border">{s.tanggal}</td>
                              <td className="p-1 border font-bold">{s.noFaktur || '-'}</td>
                              <td className="p-1 border truncate max-w-[120px]">{s.namaBarang}</td>
                              <td className="p-1 border text-center">{s.qty}</td>
                              <td className="p-1 border text-right font-bold">{formatRupiah(s.total)}</td>
                              <td className="p-1 border text-right font-black text-emerald-600">
                                {formatRupiah((s.total || 0) - ((s.hargaBeli || 0) * (s.qty || 0)))}
                              </td>
                              <td className="p-1 border text-center text-[6px] font-black">{s.statusCair === 'cair' ? 'LUNAS' : 'PEND'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-8 border-t border-slate-100 text-[8px] text-slate-400 flex justify-between italic">
                   <p>Halaman 2/2 - Detailed breakdown</p>
                   <p>Max Speed Dashboard System</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
