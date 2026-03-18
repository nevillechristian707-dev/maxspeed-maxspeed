import { useGetLaporanProfit, useGetTopProducts, useListPenjualan, useGetMe, useListTransaksiBank } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatRupiah, getIndonesianPeriodLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as ChartIcon, Trophy, FileDown, FileText, Printer, ShoppingCart, DollarSign, Landmark, Store, CreditCard, ChevronDown, DownloadCloud, Monitor, Calendar } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMonthYear } from "@/context/month-year-context";
import { useState, useMemo, useEffect, useRef } from "react";

export default function Laporan() {
  const formatDateIndo = (d: string) => {
    if (!d) return "-";
    const date = new Date(d);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  const { dateParams, selectedYear, selectedMonth } = useMonthYear();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPreview, setIsPreview] = useState(false);

  const { data: profit, isLoading: loadingProfit } = useGetLaporanProfit(dateParams);
  const { data: topProducts, isLoading: loadingTop } = useGetTopProducts({ limit: 10, ...dateParams });
  const { data: allSales, isLoading: loadingSales } = useListPenjualan(dateParams);
  const { data: bankTransactions, isLoading: loadingBank } = useListTransaksiBank(dateParams);
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

  const bankReportSummaries = useMemo(() => {
    if (!bankTransactions) return [];
    
    // Group by Date first
    const dailyGroups: Record<string, { date: string; banks: Record<string, any>; total: number }> = {};
    
    bankTransactions.forEach(tx => {
      const dateKey = tx.tanggalCair || "Unknown";
      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = { date: dateKey, banks: {}, total: 0 };
      }
      
      const bankKey = `${tx.namaBank}-${tx.rekeningBank}`;
      if (!dailyGroups[dateKey].banks[bankKey]) {
        dailyGroups[dateKey].banks[bankKey] = { bank: tx.namaBank, account: tx.rekeningBank, total: 0, count: 0, items: [] };
      }
      
      const amount = Number(tx.nilai);
      dailyGroups[dateKey].banks[bankKey].total += amount;
      dailyGroups[dateKey].banks[bankKey].count += 1;
      dailyGroups[dateKey].banks[bankKey].items.push(tx);
      dailyGroups[dateKey].total += amount;
    });

    return Object.values(dailyGroups)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(day => ({
        ...day,
        banks: Object.values(day.banks).sort((a: any, b: any) => b.total - a.total)
      }));
  }, [bankTransactions]);

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
        
        const body = cat.data.map((item: any) => {
           const s = item as any;
           const m = (s.hargaBeli || 0) * (s.qty || 0);
           const j = (cat as any).isBankTx ? (Number(s.nilai) || 0) : (s.total || 0);
           const l = (cat as any).isBankTx ? 0 : (j - m);
           return [
            s.tanggal || s.tanggalCair,
            s.noFaktur || '-',
            cat.label.includes('KREDIT') ? `${s.namaCustomer || 'Umum'} / ${s.namaBarang}` : ((cat as any).isBankTx ? `${s.namaBank} / ${s.namaBarang}` : s.namaBarang),
            (cat as any).isBankTx ? 1 : s.qty,
            formatRupiah(m),
            formatRupiah(j),
            formatRupiah(l),
            s.statusCair === 'cair' || (cat as any).isBankTx ? 'LUNAS' : 'PEND'
          ];
        });

        // Add Total Row to Body
        const totalQty = cat.data.reduce((acc: number, s: any) => acc + ((cat as any).isBankTx ? 1 : (s.qty || 0)), 0);
        const totalModal = cat.data.reduce((acc: number, s: any) => acc + ((s.hargaBeli || 0) * (s.qty || 0)), 0);
        const totalJual = cat.data.reduce((acc: number, s: any) => acc + ((cat as any).isBankTx ? (Number((s as any).nilai) || 0) : (s.total || 0)), 0);
        const totalLaba = totalJual - totalModal;

        body.push([
           '', 'TOTAL', '', totalQty.toString(), formatRupiah(totalModal), formatRupiah(totalJual), (cat as any).isBankTx ? '-' : formatRupiah(totalLaba), ''
        ]);
        
        autoTable(doc, {
          startY: currentY + 3,
          head: [['TGL', 'Faktur', 'Keterangan / Produk', 'Qty', 'Modal', 'Jual', 'Laba', 'Status']],
          body: body,
          styles: { fontSize: 6.5, cellPadding: 2 },
          headStyles: { fillColor: [30, 41, 59] },
          columnStyles: { 
            3: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right', fontStyle: 'bold' },
            7: { halign: 'center' }
          },
          didParseCell: (data) => {
            if (data.row.index === body.length - 1) {
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.fontStyle = 'bold';
            }
          },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("Dicetak otomatis oleh Sistem Dashboard Max Speed", 14, 285);
            doc.text(`Halaman ${doc.getNumberOfPages()}`, 196, 285, { align: 'right' });
          }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    // SECTION V: BANK DISBURSEMENT TIMELINE (Grouped)
    if (bankReportSummaries.length > 0) {
      doc.addPage();
      doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
      doc.text("V. HISTORI PENCAIRAN BANK (TIMELINE)", 14, 20);
      doc.setDrawColor(16, 185, 129); // Emerald
      doc.line(14, 23, 196, 23);
      
      let vY = 32;
      bankReportSummaries.forEach((day) => {
        if (vY > 260) { doc.addPage(); vY = 20; }
        
        doc.setFontSize(10); doc.setTextColor(79, 70, 229); // Indigo
        doc.text(`Timeline: ${formatDateIndo(day.date)}`, 14, vY);
        doc.setFontSize(9); doc.setTextColor(16, 185, 129);
        doc.text(`Total Kas: ${formatRupiah(day.total)}`, 196, vY, { align: 'right' });
        
        vY += 6;
        
        day.banks.forEach((bankGroup) => {
          if (vY > 260) { doc.addPage(); vY = 20; }
          
          doc.setFontSize(8); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold');
          doc.text(`Bank: ${bankGroup.bank} (${bankGroup.account})`, 16, vY);
          vY += 4;
          
          autoTable(doc, {
            startY: vY,
            head: [['Faktur', 'Produk & Brand', 'Sumber', 'Nilai Cair']],
            body: bankGroup.items.map((tx: any) => [
              tx.noFaktur || '-',
              `${tx.namaBarang} (${tx.brand || '-'})`,
              tx.sumber?.replace('_', ' ').toUpperCase(),
              formatRupiah(tx.nilai)
            ]),
            theme: 'grid',
            styles: { fontSize: 6.5, cellPadding: 2 },
            headStyles: { fillColor: [51, 65, 85] },
            columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
            margin: { left: 16, right: 14 }
          });
          
          vY = (doc as any).lastAutoTable.finalY + 10;
        });
        
        vY += 5;
      });
    }

    const filename = `Laporan_MaxSpeed_Keuangan_${selectedMonth}_${selectedYear}.pdf`;
    doc.save(filename);
  };

  const handlePrint = () => {
    setIsPreview(true);
  };

  if (loadingProfit || loadingTop || loadingSales || loadingBank) {
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
          .report-total-row td { background-color: #f8fafc !important; font-weight: 800 !important; border-top: 2px solid #1e293b !important; }
          #preview-overlay { overflow: visible !important; position: absolute !important; }
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
                <DropdownMenuLabel className="px-3 py-2 text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest">Pilih Format Output</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/10" />
                
                <DropdownMenuItem onClick={handlePrint} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/5 rounded-lg group">
                  <div className="p-2 rounded-md bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-tight">Tampilan Layar</span>
                    <span className="text-xs italic tracking-tighter text-muted-foreground">Cetak ke Printer / PDF Browser</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={exportExcel} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-emerald-500/5 rounded-lg group">
                  <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                    <FileDown className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-tight">Data Excel (.xlsx)</span>
                    <span className="text-xs italic tracking-tighter text-muted-foreground">Rincian data untuk audit & olah data</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={exportPDF} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-rose-500/5 rounded-lg group">
                  <div className="p-2 rounded-md bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-tight">Dokumen PDF (.pdf)</span>
                    <span className="text-xs italic tracking-tighter text-muted-foreground">Arsip laporan resmi bulanan</span>
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
              <p className="text-xs font-medium tracking-tight text-muted-foreground font-black uppercase tracking-tight">Perolehan Kotor (Cair + Pending)</p>
            </CardHeader>
            <CardContent className="space-y-4 py-6 relative z-10">
              <div className="flex justify-between items-center bg-secondary/10 p-4 rounded-xl border border-white/5">
                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase font-black">Total Omzet</span>
                <span className="font-black text-xl text-foreground tracking-tight">{formatRupiah(allStats.omzet)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase font-bold">Total Modal</span>
                <span className="font-bold text-orange-400/80">{formatRupiah(allStats.modal)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 shadow-inner">
                <span className="text-emerald-500 text-xs font-medium tracking-tight font-black uppercase italic">Potensi Keuntungan</span>
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
              <p className="text-xs font-medium tracking-tight text-muted-foreground font-black uppercase tracking-tight">Khusus Transaksi yang Sudah Lunas</p>
            </CardHeader>
            <CardContent className="space-y-4 py-6 relative z-10">
              <div className="flex justify-between items-center px-4 py-2 bg-background/50 rounded-lg border border-white/5">
                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase font-bold">Omzet Cair</span>
                <span className="font-black text-foreground tracking-tight">{formatRupiah(profit?.totalPenjualan)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase font-bold">Modal Cair</span>
                <span className="font-bold text-orange-400/80">- {formatRupiah(profit?.totalModal)}</span>
              </div>
              <div className="flex justify-between items-center px-2 border-b border-border/50 pb-2">
                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase font-bold">Beban Operasional</span>
                <span className="font-bold text-rose-400/80">- {formatRupiah(profit?.totalBiaya)}</span>
              </div>
              <div className="flex justify-between items-center bg-primary p-4 rounded-xl shadow-lg shadow-primary/30 transform active:scale-95 transition-transform">
                <span className="text-primary-foreground text-sm font-black uppercase tracking-wider">LABA BERSIH</span>
                <span className="text-2xl font-black text-primary-foreground tracking-tight">{formatRupiah(profit?.laba)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-secondary/20 rounded-xl border border-border/50">
                <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase font-black italic">Alokasi Laba (10%)</span>
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
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs font-medium tracking-tight text-muted-foreground uppercase bg-secondary/40 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-black tracking-widest">Produk</th>
                    <th className="px-4 py-3 text-right font-black tracking-widest">Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {topProducts?.slice(0, 10).map((p, i) => (
                    <tr key={i} className="hover:bg-primary/[0.03] transition-colors group/row">
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-medium tracking-tight font-black ${i < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</span>
                        <div>
                          <div className="font-bold text-[11px] text-foreground mb-0.5">{p.namaBarang}</div>
                          <div className="text-xs italic tracking-tighter text-muted-foreground font-mono uppercase tracking-tighter">{p.brand}</div>
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
                    <span className="ml-auto text-xs font-medium tracking-tight bg-secondary/50 px-3 py-1 rounded-full text-muted-foreground font-black tracking-widest">{cat.data.length} TRX</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-[12px] text-left border-collapse">
                      <thead className="bg-secondary/40 text-muted-foreground uppercase text-xs italic tracking-tighter tracking-widest font-black border-b border-border/50">
                        <tr>
                          <th className="px-6 py-4">Tanggal</th>
                          <th className="px-4 py-4">No. Faktur</th>
                          <th className="px-4 py-4">{cat.id === 'kredit' ? 'Customer / Produk' : 'Nama Produk'}</th>
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
                          const j = (s as any).isBankTx ? (Number(s.nilai) || 0) : (s.total || 0);
                          const l = (s as any).isBankTx ? 0 : (j - m);
                          return (
                            <tr key={s.id} className="hover:bg-primary/[0.03] transition-colors group/row">
                              <td className="px-6 py-4 whitespace-nowrap text-muted-foreground/80 font-medium">{s.tanggal || s.tanggalCair}</td>
                              <td className="px-4 py-4 font-black text-foreground tracking-tighter">{s.noFaktur || '-'}</td>
                              <td className="px-4 py-4 min-w-[200px]">
                                {cat.id === 'kredit' && <div className="text-[10px] font-black uppercase text-orange-500 mb-0.5">{s.namaCustomer || 'Umum'}</div>}
                                {(s as any).isBankTx && <div className="text-[10px] font-black uppercase text-emerald-600 mb-0.5">{s.namaBank} - {s.rekeningBank}</div>}
                                <div className="font-bold text-foreground leading-snug group-hover/row:text-primary transition-colors">{s.namaBarang}</div>
                                <div className="text-xs italic tracking-tighter text-muted-foreground/60 font-mono tracking-tighter uppercase mt-0.5">{s.kodeBarang}</div>
                              </td>
                              <td className="px-4 py-4 text-center font-black text-foreground tabular-nums">{(s as any).isBankTx ? 1 : s.qty}</td>
                              <td className="px-4 py-4 text-right text-muted-foreground italic font-medium tabular-nums">{formatRupiah(m)}</td>
                              <td className="px-4 py-4 text-right font-black text-foreground tabular-nums">{formatRupiah(j)}</td>
                              <td className={`px-4 py-4 text-right font-black text-sm tabular-nums ${l >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <span className="flex items-center justify-end gap-1">
                                  {l >= 0 ? '+' : ''}{formatRupiah(l)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-lg text-xs italic tracking-tighter font-black uppercase tracking-widest shadow-sm border ${s.statusCair === 'cair' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                                  {s.statusCair === 'cair' ? 'Lunas' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Footers for Grand Totals */}
                      <tfoot className="bg-secondary/20 font-black border-t-2 border-border/50">
                        <tr>
                          <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-widest text-xs">Total {cat.label}</td>
                          <td className="px-4 py-4 text-center tabular-nums">{cat.data.reduce((acc: number, s: any) => acc + (s.qty || 0), 0)}</td>
                          <td className="px-4 py-4 text-right tabular-nums">{formatRupiah(cat.data.reduce((acc: number, s: any) => acc + ((s.hargaBeli || 0) * (s.qty || 0)), 0))}</td>
                          <td className="px-4 py-4 text-right tabular-nums text-primary">{formatRupiah(cat.data.reduce((acc: number, s: any) => acc + (s.total || 0), 0))}</td>
                          <td className="px-4 py-4 text-right tabular-nums text-emerald-500">
                            {formatRupiah(cat.data.reduce((acc: number, s: any) => {
                              const j = s.total || 0;
                              const m = (s.hargaBeli || 0) * (s.qty || 0);
                              return acc + (j - m);
                            }, 0))}
                          </td>
                          <td className="px-6 py-4"></td>
                        </tr>
                      </tfoot>
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
                               <div className="text-xs font-medium tracking-tight font-black text-primary uppercase tracking-widest">{s.tanggal}</div>
                               <div className="text-sm font-black text-foreground mt-0.5">{s.noFaktur || '-'}</div>
                             </div>
                             <span className={`px-2 py-0.5 rounded text-xs font-bold leading-none font-black uppercase tracking-widest border ${s.statusCair === 'cair' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                                {s.statusCair === 'cair' ? 'Lunas' : 'Pending'}
                             </span>
                          </div>
                          <div className="space-y-1">
                             {cat.id === 'kredit' && <div className="text-[10px] font-black uppercase text-orange-500">{s.namaCustomer || 'Umum'}</div>}
                             <div className="text-sm font-bold text-foreground border-l-2 border-primary/30 pl-2">{s.namaBarang}</div>
                          </div>
                          <div className="flex justify-between items-end pt-1">
                             <div className="space-y-1">
                               <div className="text-xs italic tracking-tighter text-muted-foreground font-bold">Qty: {s.qty} • Jual: {formatRupiah(j)}</div>
                               <div className="text-xs italic tracking-tighter text-muted-foreground italic">Modal: {formatRupiah(m)}</div>
                             </div>
                             <div className="text-right">
                               <div className="text-xs italic tracking-tighter uppercase font-black text-muted-foreground tracking-tighter">Profit</div>
                               <div className={`text-sm font-black ${l >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{(l >= 0) ? '+' : ''}{formatRupiah(l)}</div>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Mobile Grand Total card */}
                    <div className="mt-4 p-4 bg-secondary/30 rounded-2xl border-2 border-dashed border-border/50">
                       <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Ringkasan {cat.label}</div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col">
                             <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Qty</span>
                             <span className="font-black">{cat.data.reduce((acc: number, s: any) => acc + (s.qty || 0), 0)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Jual</span>
                             <span className="font-black text-primary">{formatRupiah(cat.data.reduce((acc: number, s: any) => acc + (s.total || 0), 0))}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Modal</span>
                             <span className="font-black">{formatRupiah(cat.data.reduce((acc: number, s: any) => acc + ((s.hargaBeli || 0) * (s.qty || 0)), 0))}</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Profit</span>
                             <span className="font-black text-emerald-500">
                                {formatRupiah(cat.data.reduce((acc: number, s: any) => {
                                  const jj = s.total || 0;
                                  const mm = (s.hargaBeli || 0) * (s.qty || 0);
                                  return acc + (jj - mm);
                                }, 0))}
                             </span>
                          </div>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* BANK DISBURSEMENT HISTORY (Same as Pencairan Page) */}
        {bankReportSummaries.length > 0 && (
          <div className="mt-12 space-y-8 pb-10">
            <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-3 border-l-4 border-emerald-500 pl-4 uppercase tracking-tighter">
              <Landmark className="text-emerald-500 w-6 h-6" /> Laporan Pencairan Bank
            </h2>
            
            <div className="space-y-12">
              {bankReportSummaries.map((dayGroup, i) => (
                <div key={i} className="group/day relative">
                  <div className="absolute -left-6 top-10 bottom-0 w-0.5 bg-border/20 hidden xl:block" />
                  
                  {/* Day Header */}
                  <div className="bg-indigo-500/10 px-6 py-4 rounded-2xl border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-4 z-20 backdrop-blur-xl shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shadow-inner">
                        <Calendar className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-lg font-black uppercase tracking-widest text-indigo-100">{formatDateIndo(dayGroup.date)}</span>
                        <div className="text-xs font-bold text-indigo-400 uppercase mt-0.5 tracking-widest">Dana Cair Harian</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="text-xs font-black text-muted-foreground uppercase opacity-40 hidden sm:inline">Total Kas Masuk:</span>
                       <span className="bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-full border border-emerald-500/30 shadow-lg shadow-emerald-500/10 font-black text-xl">{formatRupiah(dayGroup.total)}</span>
                    </div>
                  </div>

                  {/* Banks Grouping */}
                  <div className="mt-8 space-y-8 pl-0 xl:pl-4">
                    {dayGroup.banks.map((bankGroup, j) => (
                      <Card key={j} className="border-border/40 shadow-xl overflow-hidden bg-card/40 backdrop-blur-md">
                        <div className="bg-emerald-500/[0.03] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-background rounded-xl border border-emerald-500/30 shadow-sm">
                              <Landmark className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                              <h3 className="text-base font-black text-foreground uppercase tracking-tight">{bankGroup.bank}</h3>
                              <p className="text-xs font-mono text-muted-foreground tracking-tight">{bankGroup.account}</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between items-center sm:items-end gap-2">
                            <div className="text-2xl font-black text-emerald-600">{formatRupiah(bankGroup.total)}</div>
                            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase rounded-full border border-emerald-500/20">{bankGroup.count} Transaksi</div>
                          </div>
                        </div>
                        
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-[12px] text-left border-collapse">
                              <thead className="bg-secondary/40 text-muted-foreground uppercase text-xs italic tracking-widest font-black border-b border-border/50">
                                <tr>
                                  <th className="px-6 py-4">Tgl TRX</th>
                                  <th className="px-4 py-4">Faktur / TRX</th>
                                  <th className="px-4 py-4">Produk & Brand</th>
                                  <th className="px-4 py-4">Sumber Dana</th>
                                  <th className="px-4 py-4 text-right">TOTAL CAIR</th>
                                  <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/10">
                                {bankGroup.items.map((tx: any) => (
                                  <tr key={tx.id} className="hover:bg-emerald-500/[0.02] transition-colors group/row">
                                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-bold">{tx.tanggal}</td>
                                    <td className="px-4 py-4">
                                      <div className="font-bold text-foreground">{tx.noFaktur || '-'}</div>
                                      <div className="text-[10px] font-bold text-muted-foreground/50 font-mono">ID: {tx.kodeTransaksi}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="font-bold text-foreground truncate max-w-[200px]">{tx.namaBarang}</div>
                                      <div className="text-[10px] font-black text-primary uppercase mt-0.5">{tx.brand || '-'} • {tx.kodeBarang}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">{tx.sumber?.replace('_', ' ')}</span>
                                      <div className="font-bold text-foreground text-xs">{tx.sumber === 'online_shop' ? tx.namaOnlineShop : tx.namaCustomer}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-black text-emerald-600">{formatRupiah(tx.nilai)}</td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">Lunas</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
              <p className="text-sm font-black uppercase text-white tracking-widest">Preview Laporan Layar (A4 Layout)</p>
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
                  <p className="text-slate-500 uppercase tracking-[0.2em] font-medium text-xs font-medium tracking-tight">Laporan Keuangan Strategis & Performa Perusahaan</p>
                  <div className="mt-4 flex justify-center gap-3">
                     <span className="px-4 py-1 bg-slate-100 rounded-full text-xs font-medium tracking-tight font-black uppercase tracking-widest text-slate-700">Periode: {getIndonesianPeriodLabel(selectedMonth, selectedYear)}</span>
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
                    <table className="w-full text-xs italic tracking-tighter">
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
                               <div className="text-xs font-bold leading-none opacity-50 text-slate-500 uppercase">{p.brand}</div>
                            </td>
                            <td className="text-right font-bold">{formatRupiah(p.totalPenjualan)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </div>

                <div className="mt-auto pt-8 border-t border-slate-100 text-xs font-bold leading-none text-slate-400 flex justify-between italic">
                   <p>Halaman 1/2 - Strategic Recap</p>
                   <p>Dicetak Pada: {new Date().toLocaleString('id-ID')}</p>
                </div>
              </div>

              {/* PAGE 2+: DETAILED BREAKDOWN - AUTO SPACING */}
              {(() => {
                const list: any[] = [];
                [
                  { label: 'CASH (TUNAI)', data: salesByCategory.cash },
                  { label: 'BANK (TRANSFER)', data: salesByCategory.bank },
                  { label: 'ONLINE SHOP', data: salesByCategory.online_shop },
                  { label: 'KREDIT (TEMPO)', data: salesByCategory.kredit }
                ].forEach(cat => {
                  if (cat.data.length > 0) {
                    list.push({ isHeader: true, label: cat.label });
                    cat.data.forEach((item, idxx) => {
                      list.push({ isHeader: false, ...item, id: `${cat.label}-${idxx}`, isBankTx: (cat as any).isBankTx, categoryId: (cat as any).label });
                    });
                    // Add Summary Row
                    const tQty = cat.data.reduce((acc: number, s: any) => acc + ((cat as any).isBankTx ? 1 : (s.qty || 0)), 0);
                    const tJual = cat.data.reduce((acc: number, s: any) => acc + ((cat as any).isBankTx ? (Number(s.nilai) || 0) : (s.total || 0)), 0);
                    list.push({ isTotal: true, label: `TOTAL ${cat.label}`, qty: tQty, total: tJual });
                  }
                });

                // Split list into chunks for pages
                const pageSize = 25;
                const chunks = [];
                for (let i = 0; i < list.length; i += pageSize) {
                  chunks.push(list.slice(i, i + pageSize));
                }

                return chunks.map((chunk, pageIdx) => (
                  <div key={pageIdx} className="report-page">
                    <div className="flex justify-between items-center border-b border-primary/20 pb-2 mb-4">
                       <h3 className="m-0 border-none p-0">IV. Rincian Penjualan per Metode Bayar</h3>
                       <span className="text-xs font-medium tracking-tight font-black text-slate-400">BAGIAN {pageIdx + 1}/{chunks.length}</span>
                    </div>
                    <div className="space-y-4 flex-1">
                      {chunk.map((item, itemIdx) => {
                        if (item.isHeader) {
                          return (
                            <div key={itemIdx} className="bg-slate-900 text-white px-3 py-1.5 text-xs italic tracking-tighter font-black uppercase tracking-widest mt-4 first:mt-0 shadow-sm flex justify-between">
                              <span>KATEGORI: {item.label}</span>
                              <span className="text-[8px] opacity-60">Faktur / Produk / Transaksi</span>
                            </div>
                          );
                        }
                        if (item.isTotal) {
                          return (
                            <div key={itemIdx} className="grid grid-cols-7 gap-2 bg-slate-50 border-y-2 border-slate-900 rounded p-2 text-xs font-bold leading-none items-center mt-1 mb-4">
                               <div className="col-span-4 text-right font-black uppercase tracking-widest">{item.label}</div>
                               <div className="text-center font-black">{item.qty}</div>
                               <div className="text-right font-black text-primary text-[10px]">{formatRupiah(item.total)}</div>
                               <div className=""></div>
                            </div>
                          );
                        }
                        return (
                          <div key={item.id} className="grid grid-cols-7 gap-2 border border-slate-200 rounded p-1.5 text-xs font-bold leading-none items-center hover:bg-slate-50 transition-colors">
                            <div className="font-medium text-slate-500">{item.tanggal || item.tanggalCair}</div>
                            <div className="font-black text-slate-900 border-l px-2">{item.noFaktur || '-'}</div>
                            <div className="col-span-2 font-bold truncate opacity-80 leading-tight">
                               {item.categoryId === 'KREDIT (TEMPO)' && <div className="text-[6px] text-orange-600 font-black">{item.namaCustomer || 'UMUM'}</div>}
                               {item.isBankTx && <div className="text-[6px] text-emerald-600 font-black">{item.namaBank}</div>}
                               {item.namaBarang}
                            </div>
                            <div className="text-center font-black">{item.isBankTx ? 1 : item.qty}</div>
                            <div className="text-right font-black text-primary text-[9px]">{formatRupiah(item.isBankTx ? item.nilai : item.total)}</div>
                            <div className="text-center bg-slate-100 rounded py-0.5 font-black uppercase tracking-tighter text-[6px] border border-slate-200">
                                {item.statusCair === 'cair' || item.isBankTx ? 'LUNAS' : 'PEND'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-auto pt-4 border-t border-slate-100 text-xs font-bold leading-none text-slate-400 flex justify-between italic">
                       <p>Halaman Detail ({pageIdx + 1}/{chunks.length})</p>
                       <p>MAX SPEED Dashboard Analytical Report • {new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                ));
              })()}

              {/* PAGE X: HISTORI PENCAIRAN BANK - GROUPS */}
              {bankReportSummaries.length > 0 && 
                <div className="report-page break-before-page">
                   <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 mb-6">
                      <h3 className="m-0 border-none p-0 text-emerald-600">V. Histori Pencairan Bank per Hari</h3>
                      <span className="text-[10px] font-black uppercase text-slate-400 px-3 py-1 bg-slate-100 rounded-full">Report Timeline</span>
                   </div>
                   
                   <div className="space-y-10">
                      {bankReportSummaries.map((dayGroup, i) => (
                        <div key={i} className="relative pl-6 border-l-2 border-indigo-100 pb-2">
                           <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                           
                           <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50/80 px-3 py-1 rounded-lg border border-indigo-100">{formatDateIndo(dayGroup.date)}</span>
                              <span className="text-[11px] font-black text-emerald-600">{formatRupiah(dayGroup.total)}</span>
                           </div>

                           <div className="space-y-4">
                              {dayGroup.banks.map((bank, j) => (
                                <div key={j} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                   <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                                      <div className="flex items-center gap-2">
                                         <Landmark className="w-3.5 h-3.5 text-emerald-500" />
                                         <span className="text-[10px] font-black uppercase text-slate-700">{bank.bank} • {bank.account}</span>
                                      </div>
                                      <span className="text-[10px] font-black text-emerald-700">{formatRupiah(bank.total)} ({bank.count} Trx)</span>
                                   </div>
                                   <div className="p-0">
                                      <table className="w-full text-[9px] leading-tight">
                                         <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase italic">
                                            <tr>
                                               <th className="px-3 py-1 text-left">Faktur</th>
                                               <th className="px-3 py-1 text-left">Produk</th>
                                               <th className="px-3 py-1 text-left">Sumber</th>
                                               <th className="px-3 py-1 text-right">Nilai</th>
                                            </tr>
                                         </thead>
                                         <tbody>
                                            {bank.items.map((tx: any, txIdx: number) => (
                                              <tr key={txIdx} className="border-b border-slate-50 last:border-0">
                                                 <td className="px-3 py-1.5 font-bold">{tx.noFaktur || '-'}</td>
                                                 <td className="px-3 py-1.5 font-medium opacity-80">{tx.namaBarang}</td>
                                                 <td className="px-3 py-1.5 text-[8px] uppercase font-black text-slate-400">{tx.sumber?.replace('_', ' ')}</td>
                                                 <td className="px-3 py-1.5 text-right font-black text-emerald-600">{formatRupiah(tx.nilai)}</td>
                                              </tr>
                                            ))}
                                         </tbody>
                                      </table>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                   
                   <div className="mt-auto pt-8 border-t border-slate-100 text-[10px] font-bold text-slate-400 flex justify-between italic">
                      <p>Halaman Timeline Pencairan</p>
                      <p>© {new Date().getFullYear()} MAX SPEED • Analytic Insight</p>
                   </div>
                </div>
              }
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
