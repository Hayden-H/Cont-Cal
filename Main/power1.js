var device = null;
var devname = "";
var mode = 0;
var disable_btn = false;

var lang_orig_text = {};
var lang_cur = {};
var lang_disabled = true;
var gj = 0;
var gu = 0;




function buf2hex(buffer) {
    return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function dec2hex(i) {
    return (i + 0x10000).toString(16).substr(-4).toUpperCase();
}

function dec2hex32(i) {
    return (i + 0x100000000).toString(16).substr(-8).toUpperCase();
}

function dec2hex8(i) {
    return (i + 0x100).toString(16).substr(-2).toUpperCase();
}

function ds5_hw_to_bm(hw_ver) {
    let a = (hw_ver >> 8) & 0xff;
    switch (a) {
        case 0x03: return "BDM-010";
        case 0x04: return "BDM-020";
        case 0x05: return "BDM-030";
        case 0x06: return "BDM-040";
        default: return "Unknown";
    }
}

function ds4_hw_to_bm(hw_ver) {
    let a = hw_ver >> 8;
    if (a == 0x31) return "JDM-001";
    else if (a == 0x43) return "JDM-011";
    else if (a == 0x54) return "JDM-030";
    else if (a >= 0x64 && a <= 0x74) return "JDM-040";
    else if ((a > 0x80 && a < 0x84) || a == 0x93) return "JDM-020";
    else if (a == 0xa4) return "JDM-050";
    else if (a == 0xb0) return "JDM-055 (Scuf?)";
    else if (a == 0xb4) return "JDM-055";
    else if (is_rare(hw_ver)) return "WOW!";
    else return "Unknown";
}


function is_rare(hw_ver) {
    a = hw_ver >> 8;
    b = a >> 4;
    return ((b == 7 && a > 0x74) || (b == 9 && a != 0x93) || a == 0xa0);
}

async function ds4_info() {
    try {
        const view = lf("ds4_info", await device.receiveFeatureReport(0xa3));

        var cmd = view.getUint8(0, true);
        if (cmd != 0xa3 || view.buffer.byteLength != 49) {
            return false;
        }

        var k1 = new TextDecoder().decode(view.buffer.slice(1, 0x10));
        var k2 = new TextDecoder().decode(view.buffer.slice(0x10, 0x20));
        k1 = k1.replace(/\0/g, '');
        k2 = k2.replace(/\0/g, '');

        var hw_ver_major = view.getUint16(0x21, true)
        var hw_ver_minor = view.getUint16(0x23, true)
        var sw_ver_major = view.getUint32(0x25, true)
        var sw_ver_minor = view.getUint16(0x25 + 4, true)
        var ooc = l("unknown");

        ooc = l("original");

        var is_clone = false;
        try {
            const view = await device.receiveFeatureReport(0x81);
            ooc = l("original");
        } catch (e) {
            console.log("clone");
            is_clone = true;
            ooc = "<font color='red'><b>" + l("clone") + "</b></font>";
            disable_btn = true;
        }


        append_info(l("Build Date:"), k1 + " " + k2);
        append_info(l("HW Version:"), "" + dec2hex(hw_ver_major) + ":" + dec2hex(hw_ver_minor));
        append_info(l("SW Version:"), dec2hex32(sw_ver_major) + ":" + dec2hex(sw_ver_minor));
        append_info(l("Device Type:"), ooc);
        if (!is_clone) {
            b_info = '&nbsp;<a class="link-body-emphasis" href="#" onclick="board_model_info()">' +
                '<svg class="bi" width="1.3em" height="1.3em"><use xlink:href="#info"/></svg></a>';
            append_info(l("Board Model:"), ds4_hw_to_bm(hw_ver_minor) + b_info);

            // All ok, safe to query NVS Status and BD Addr
            await ds4_nvstatus();
            await ds4_getbdaddr();

            if (is_rare(hw_ver_minor)) {
                show_popup("Wow, this is a rare/weird controller! Please write me an email at ds4@the.al or contact me on Discord (the_al)");
            }
        }
    } catch (e) {
        ooc = "<font color='red'><b>" + l("clone") + "</b></font>";
        disable_btn = true;
    }
    return true;
}

async function ds4_reset() {
    console.log("ds4_reset");
    try {
        await device.sendFeatureReport(0xa0, alloc_req(0xa0, [4, 1, 0]))
    } catch (error) {
    }
}

async function ds5_reset() {
    console.log("ds5_reset");
    try {
        await device.sendFeatureReport(0x80, alloc_req(0x80, [1, 1, 0]))
    } catch (error) {
    }
}

async function ds4_calibrate_range_begin(perm_ch) {
    console.log("ds4_calibrate_range_begin", { "p": perm_ch });
    var err = ("Range calibration failed: ");
    try {
        if (perm_ch) {
            await ds4_nvunlock();
            if (await ds4_nvstatus() != 0) {
                console.log("ds4_calibrate_range_begin_failed", { "r": "nvunlock" });
                close_calibrate_window();
                return show_popup(err + l("Cannot unlock NVS"));
            }
        }

        // Begin
        await device.sendFeatureReport(0x90, alloc_req(0x90, [1, 1, 2]))

        // Assert
        data = await device.receiveFeatureReport(0x91)
        data2 = await device.receiveFeatureReport(0x92)
        d1 = data.getUint32(0, false);
        d2 = data2.getUint32(0, false);
        if (d1 != 0x91010201 || d2 != 0x920102ff) {
            console.log("ds4_calibrate_range_begin_failed", { "d1": d1, "d2": d2 });
            close_calibrate_window();
            return show_popup(err + l("Error 1"));
        }
    } catch (e) {
        console.log("ds4_calibrate_range_begin_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
        return;
    }
}

async function ds4_calibrate_range_end(perm_ch) {
    console.log("ds4_calibrate_range_end", { "p": perm_ch });
    var err = l("Range calibration failed: ");
    try {
        // Write
        await device.sendFeatureReport(0x90, alloc_req(0x90, [2, 1, 2]))

        data = await device.receiveFeatureReport(0x91)
        data2 = await device.receiveFeatureReport(0x92)
        d1 = data.getUint32(0, false);
        d2 = data2.getUint32(0, false);
        if (d1 != 0x91010202 || d2 != 0x92010201) {
            console.log("ds4_calibrate_range_end_failed", { "d1": d1, "d2": d2 });
            close_calibrate_window();
            return show_popup(err + l("Error 3"));
        }

        if (perm_ch) {
            await ds4_nvlock();
            if (await ds4_nvstatus() != 1) {
                console.log("ds4_calibrate_range_end_failed", { "r": "nvlock" });
                close_calibrate_window();
                return show_popup(err + l("Cannot relock NVS"));
            }
        }

        close_calibrate_window();
        show_popup(l("Range calibration completed"));
    } catch (e) {
        console.log("ds4_calibrate_range_end_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
        return show_popup(err + e);
    }
}

async function ds4_calibrate_sticks_begin(has_perm_changes) {
    console.log("ds4_calibrate_sticks_begin", { "p": has_perm_changes });
    var err = "Stick calibration failed: ";
    try {
        if (has_perm_changes) {
            await ds4_nvunlock();
            if (await ds4_nvstatus() != 0) {
                console.log("ds4_calibrate_sticks_begin_failed", { "r": "nvunlock" });
                show_popup(err + l("Cannot unlock NVS"));
                return false;
            }
        }

        // Begin
        await device.sendFeatureReport(0x90, alloc_req(0x90, [1, 1, 1]))

        // Assert
        data = await device.receiveFeatureReport(0x91);
        data2 = await device.receiveFeatureReport(0x92);
        d1 = data.getUint32(0, false);
        d2 = data2.getUint32(0, false);
        if (d1 != 0x91010101 || d2 != 0x920101ff) {
            console.log("ds4_calibrate_sticks_begin_failed", { "d1": d1, "d2": d2 });
            show_popup(err + l("Error 1"));
            return false;
        }

        return true;
    } catch (e) {
        console.log("ds4_calibrate_sticks_begin_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        return false;
    }
}

async function ds4_calibrate_sticks_sample() {
    console.log("ds4_calibrate_sticks_sample");
    var err = l("Stick calibration failed: ");
    try {
        // Sample
        await device.sendFeatureReport(0x90, alloc_req(0x90, [3, 1, 1]))

        // Assert
        data = await device.receiveFeatureReport(0x91);
        data2 = await device.receiveFeatureReport(0x92);
        if (data.getUint32(0, false) != 0x91010101 || data2.getUint32(0, false) != 0x920101ff) {
            close_calibrate_window();
            d1 = dec2hex32(data.getUint32(0, false));
            d2 = dec2hex32(data2.getUint32(0, false));
            console.log("ds4_calibrate_sticks_sample_failed", { "d1": d1, "d2": d2 });
            show_popup(err + l("Error 2") + " (" + d1 + ", " + d2 + " at i=" + i + ")");
            return false;
        }
        return true;
    } catch (e) {
        await new Promise(r => setTimeout(r, 500));
        show_popup(err + e);
        return false;
    }
}

async function ds4_calibrate_sticks_end(has_perm_changes) {
    console.log("ds4_calibrate_sticks_end", { "p": has_perm_changes });
    var err = l("Stick calibration failed: ");
    try {
        // Write
        await device.sendFeatureReport(0x90, alloc_req(0x90, [2, 1, 1]))
        if (data.getUint32(0, false) != 0x91010101 || data2.getUint32(0, false) != 0x920101FF) {
            d1 = dec2hex32(data.getUint32(0, false));
            d2 = dec2hex32(data2.getUint32(0, false));
            console.log("ds4_calibrate_sticks_end_failed", { "d1": d1, "d2": d2 });
            show_popup(err + l("Error 3") + " (" + d1 + ", " + d2 + " at i=" + i + ")");
            return false;
        }

        if (has_perm_changes) {
            await ds4_nvlock();
            if (await ds4_nvstatus() != 1) {
                console.log("ds4_calibrate_sticks_end_failed", { "r": "nvlock" });
                show_popup(err + l("Cannot relock NVS"));
                return false;
            }
        }

        return true;
    } catch (e) {
        console.log("ds4_calibrate_sticks_end_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        show_popup(err + e);
        return false;
    }
}

async function ds4_calibrate_sticks() {
    console.log("ds4_calibrate_sticks");
    var err = ("Stick calibration failed: ");
    try {
        set_progress(0);

        // Begin
        await device.sendFeatureReport(0x90, alloc_req(0x90, [1, 1, 1]))

        // Assert
        data = await device.receiveFeatureReport(0x91);
        data2 = await device.receiveFeatureReport(0x92);
        d1 = data.getUint32(0, false);
        d2 = data2.getUint32(0, false);
        if (d1 != 0x91010101 || d2 != 0x920101ff) {
            console.log("ds4_calibrate_sticks_failed", { "s": 1, "d1": d1, "d2": d2 });
            close_calibrate_window();
            return show_popup(err + l("Error 1"));
        }

        set_progress(10);
        await new Promise(r => setTimeout(r, 100));

        for (var i = 0; i < 3; i++) {
            // Sample
            await device.sendFeatureReport(0x90, alloc_req(0x90, [3, 1, 1]))

            // Assert
            data = await device.receiveFeatureReport(0x91);
            data2 = await device.receiveFeatureReport(0x92);
            if (data.getUint32(0, false) != 0x91010101 || data2.getUint32(0, false) != 0x920101ff) {
                d1 = dec2hex32(data.getUint32(0, false));
                d2 = dec2hex32(data2.getUint32(0, false));
                console.log("ds4_calibrate_sticks_failed", { "s": 2, "i": i, "d1": d1, "d2": d2 });
                close_calibrate_window();
                return show_popup(err + l("Error 2") + " (" + d1 + ", " + d2 + " at i=" + i + ")");
            }

            await new Promise(r => setTimeout(r, 500));
            set_progress(20 + i * 30);
        }

        // Write
        await device.sendFeatureReport(0x90, alloc_req(0x90, [2, 1, 1]))
        if (data.getUint32(0, false) != 0x91010101 || data2.getUint32(0, false) != 0x920101FF) {
            d1 = dec2hex32(data.getUint32(0, false));
            d2 = dec2hex32(data2.getUint32(0, false));
            console.log("ds4_calibrate_sticks_failed", { "s": 3, "d1": d1, "d2": d2 });
            close_calibrate_window();
            return show_popup(err + l("Error 3") + " (" + d1 + ", " + d2 + " at i=" + i + ")");
        }

        set_progress(100);
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window()
        show_popup(l("Stick calibration completed"));
    } catch (e) {
        console.log("ds4_calibrate_sticks_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
        return
    }
}

async function ds4_nvstatus() {
    await device.sendFeatureReport(0x08, alloc_req(0x08, [0xff, 0, 12]))
    data = lf("ds4_nvstatus", await device.receiveFeatureReport(0x11))
    // 1: temporary, 0: permanent
    ret = data.getUint8(1, false);
    if (ret == 1) {
        $("#d-nvstatus").html("<font color='green'>" + l("locked") + "</font>");
    } else if (ret == 0) {
        $("#d-nvstatus").html("<font color='red'>" + l("unlocked") + "</font>");
    } else {
        $("#d-nvstatus").html("<font color='purple'>unk " + ret + "</font>");
    }
    return ret;
}

async function ds5_nvstatus() {
    try {
        await device.sendFeatureReport(0x80, alloc_req(0x80, [3, 3]))
        data = lf("ds5_nvstatus", await device.receiveFeatureReport(0x81))
        ret = data.getUint32(1, false);
        if (ret == 0x03030201) {
            $("#d-nvstatus").html("<font color='green'>" + ("locked") + "</font>");
            return 1; // temporary
        } else if (ret == 0x03030200) {
            $("#d-nvstatus").html("<font color='red'>" + ("unlocked") + "</font>");
            return 0; // permanent
        } else {
            $("#d-nvstatus").html("<font color='purple'>unk " + dec2hex32(ret) + "</font>");
            return ret; // unknown
        }
    } catch (e) {
        $("#d-nvstatus").html("<font color='red'>" + ("error") + "</font>");
        return 2; // error
    }
}

async function ds4_getbdaddr() {
    try {
        data = lf("ds4_getbdaddr", await device.receiveFeatureReport(0x12));
        out = ""
        for (i = 0; i < 6; i++) {
            if (i >= 1) out += ":";
            out += dec2hex8(data.getUint8(i, false));
        }
        $("#d-bdaddr").text(out);
        return out;
    } catch (e) {
        $("#d-bdaddr").html("<font color='red'>" + l("error") + "</font>");
        return "error";
    }
}

async function ds5_getbdaddr() {
    try {
        await device.sendFeatureReport(0x80, alloc_req(0x80, [9, 2]));
        data = lf("ds5_getbdaddr", await device.receiveFeatureReport(0x81));
        out = ""
        for (i = 0; i < 6; i++) {
            if (i >= 1) out += ":";
            out += dec2hex8(data.getUint8(4 + 5 - i, false));
        }
        $("#d-bdaddr").text(out);
        return out;
    } catch (e) {
        $("#d-bdaddr").html("<font color='red'>" + ("error") + "</font>");
        return "error";
    }
}

async function ds4_nvlock() {
    console.log("ds4_nvlock");
    await device.sendFeatureReport(0xa0, alloc_req(0xa0, [10, 1, 0]))
}

async function ds4_nvunlock() {
    console.log("ds4_nvunlock");
    await device.sendFeatureReport(0xa0, alloc_req(0xa0, [10, 2, 0x3e, 0x71, 0x7f, 0x89]))
}

async function ds5_info() {
    try {
        const view = lf("ds5_info", await device.receiveFeatureReport(0x20));

        var cmd = view.getUint8(0, true);
        if (cmd != 0x20 || view.buffer.byteLength != 64)
            return false;

        var build_date = new TextDecoder().decode(view.buffer.slice(1, 1 + 11));
        var build_time = new TextDecoder().decode(view.buffer.slice(12, 20));

        var fwtype = view.getUint16(20, true);
        var swseries = view.getUint16(22, true);
        var hwinfo = view.getUint32(24, true);
        var fwversion = view.getUint32(28, true);

        var deviceinfo = new TextDecoder().decode(view.buffer.slice(32, 32 + 12));
        var updversion = view.getUint16(44, true);
        var unk = view.getUint16(46, true);

        var fwversion1 = view.getUint32(50, true);
        var fwversion2 = view.getUint32(54, true);
        var fwversion3 = view.getUint32(58, true);

        clear_info();

        append_info(("Build Date:"), build_date + " " + build_time);
        append_info(("Firmware Type:"), "0x" + dec2hex(fwtype));
        append_info(("SW Series:"), "0x" + dec2hex(swseries));
        append_info(("HW Info:"), "0x" + dec2hex32(hwinfo));
        append_info(("SW Version:"), "0x" + dec2hex32(fwversion));
        append_info(("UPD Version:"), "0x" + dec2hex(updversion));
        append_info(("FW Version1:"), "0x" + dec2hex32(fwversion1));
        append_info(("FW Version2:"), "0x" + dec2hex32(fwversion2));
        append_info(("FW Version3:"), "0x" + dec2hex32(fwversion3));

        b_info = '&nbsp;<a class="link-body-emphasis" href="#" onclick="board_model_info()">' +
            '<svg class="bi" width="1.3em" height="1.3em"><use xlink:href="#info"/></svg></a>';
        append_info(("Board Model:"), ds5_hw_to_bm(hwinfo) + b_info);

        old_controller = build_date.search(/ 2020| 2021/);
        if (old_controller != -1) {
            console.log("ds5_info_error", { "r": "old" })
            disable_btn = true;
            return true;
        }

        await ds5_nvstatus();
        await ds5_getbdaddr();
    } catch (e) {
        console.log("ds5_info_error", { "r": e })
        show_popup(l("Cannot read controller information"));
        return false;
    }
    return true;
}

async function ds5_calibrate_sticks_begin(has_perm_changes) {
    console.log("ds5_calibrate_sticks_begin", { "p": has_perm_changes });
    var err = ("Range calibration failed: ");
    try {
        if (has_perm_changes) {
            await ds5_nvunlock();
            if (await ds5_nvstatus() != 0) {
                console.log("ds5_calibrate_sticks_begin_failed", { "r": "nvunlock" });
                show_popup(err + l("Cannot unlock NVS"));
                return false;
            }
        }
        // Begin
        await device.sendFeatureReport(0x82, alloc_req(0x82, [1, 1, 1]))

        // Assert
        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010101) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_sticks_begin_failed", { "d1": d1 });
            show_popup(err + l("Error 1") + " (" + d1 + ").");
            return false;
        }
        return true;
    } catch (e) {
        console.log("ds5_calibrate_sticks_begin_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        return false;
    }
}

async function ds5_calibrate_sticks_sample() {
    console.log("ds5_calibrate_sticks_sample");
    var err = ("Stick calibration failed: ");
    try {
        // Sample
        await device.sendFeatureReport(0x82, alloc_req(0x82, [3, 1, 1]))

        // Assert
        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010101) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_sticks_sample_failed", { "d1": d1 });
            show_popup(err + l("Error 2") + " (" + d1 + ").");
            return false;
        }
        return true;
    } catch (e) {
        console.log("ds5_calibrate_sticks_sample_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        return false;
    }
}

async function ds5_calibrate_sticks_end(has_perm_changes) {
    console.log("ds5_calibrate_sticks_end", { "p": has_perm_changes });
    var err = ("Stick calibration failed: ");
    try {
        // Write
        await device.sendFeatureReport(0x82, alloc_req(0x82, [2, 1, 1]))

        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010102) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_sticks_end_failed", { "d1": d1 });
            return false;
        }

        if (has_perm_changes) {
            await ds5_nvlock();
            if (await ds5_nvstatus() != 1) {
                console.log("ds5_calibrate_sticks_end_failed", { "r": "nvlock" });
                show_popup(err + l("Cannot relock NVS"));
                return false;
            }
        }
        return true;
    } catch (e) {
        console.log("ds5_calibrate_sticks_end_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        return false;
    }
}

async function ds5_calibrate_sticks() {
    console.log("ds5_fast_calibrate_sticks");
    var err = ("Stick calibration failed: ");
    try {
        set_progress(0);

        // Begin
        await device.sendFeatureReport(0x82, alloc_req(0x82, [1, 1, 1]))

        // Assert
        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010101) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_sticks_failed", { "s": 1, "d1": d1 });
            close_calibrate_window();
            return show_popup(err + l("Error 1") + " (" + d1 + ").");
        }

        set_progress(10);

        await new Promise(r => setTimeout(r, 100));

        for (var i = 0; i < 3; i++) {
            // Sample
            await device.sendFeatureReport(0x82, alloc_req(0x82, [3, 1, 1]))

            // Assert
            data = await device.receiveFeatureReport(0x83)
            if (data.getUint32(0, false) != 0x83010101) {
                d1 = dec2hex32(data.getUint32(0, false));
                console.log("ds5_calibrate_sticks_failed", { "s": 2, "i": i, "d1": d1 });
                close_calibrate_window();
                return show_popup(err + l("Error 2") + " (" + d1 + ").");
            }

            await new Promise(r => setTimeout(r, 500));
            set_progress(20 + i * 20);
        }

        await new Promise(r => setTimeout(r, 200));
        set_progress(80);

        // Write
        await device.sendFeatureReport(0x82, alloc_req(0x82, [2, 1, 1]))

        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010102) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_sticks_failed", { "s": 3, "d1": d1 });
            close_calibrate_window();
            return show_popup(err + l("Error 3") + " (" + d1 + ").");
        }

        set_progress(100);

        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window()

        show_popup(l("Stick calibration completed"));
    } catch (e) {
        console.log("ds5_calibrate_sticks_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
        return show_popup(err + e);
    }
}

async function ds5_calibrate_range_begin(perm_ch) {
    console.log("ds5_calibrate_range_begin", { "p": perm_ch });
    var err = ("Range calibration failed: ");
    try {
        if (perm_ch) {
            await ds5_nvunlock();
            if (await ds5_nvstatus() != 0) {
                console.log("ds5_calibrate_range_begin_failed", { "r": "nvunlock" });
                close_calibrate_window();
                return show_popup(err + ("Cannot unlock NVS"));
            }
        }

        // Begin
        await device.sendFeatureReport(0x82, alloc_req(0x82, [1, 1, 2]))

        // Assert
        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010201) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_range_begin_failed", { "d1": d1 });
            close_calibrate_window();
            return show_popup(err + l("Error 1") + " (" + d1 + ").");
        }
    } catch (e) {
        console.log("ds5_calibrate_range_begin_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
        return show_popup(err + e);
    }
}

async function ds5_calibrate_range_end(perm_ch) {
    console.log("ds5_calibrate_range_end", { "p": perm_ch });
    var err = l("Range calibration failed: ");
    try {
        // Write
        await device.sendFeatureReport(0x82, alloc_req(0x82, [2, 1, 2]))

        // Assert
        data = await device.receiveFeatureReport(0x83)
        if (data.getUint32(0, false) != 0x83010202) {
            d1 = dec2hex32(data.getUint32(0, false));
            console.log("ds5_calibrate_range_end_failed", { "d1": d1 });
            close_calibrate_window();
            return show_popup(err + l("Error 1") + " (" + d1 + ").");
        }

        if (perm_ch) {
            await ds5_nvlock();
            if (await ds5_nvstatus() != 1) {
                console.log("ds5_calibrate_range_end_failed", { "r": "nvlock" });
                close_calibrate_window();
                return show_popup(err + l("Cannot relock NVS"));
            }
        }

        close_calibrate_window();
        show_popup(l("Range calibration completed"));
    } catch (e) {
        console.log("ds5_calibrate_range_end_failed", { "r": e });
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
        return show_popup(err + e);
    }
}

async function ds5_nvlock() {
    console.log("ds5_nvlock");
    try {
        await device.sendFeatureReport(0x80, alloc_req(0x80, [3, 1]))
        data = await device.receiveFeatureReport(0x83)
    } catch (e) {
        await new Promise(r => setTimeout(r, 500));
        return console.log("NVS Lock failed: " + e);
    }
}

async function ds5_nvunlock() {
    console.log("ds5_nvunlock");
    try {
        await device.sendFeatureReport(0x80, alloc_req(0x80, [3, 2, 101, 50, 64, 12]))
        data = await device.receiveFeatureReport(0x83)
    } catch (e) {
        await new Promise(r => setTimeout(r, 500));
        close_calibrate_window();
    }
}

async function disconnect() {
    console.log("disconnect");
    if (device == null)
        return;
    gj = 0;
    mode = 0;
    device.close();
    device = null;
    disable_btn = false;
    reset_circularity();
    $("#offlinebar").show();
    $("#onlinebar").hide();
    $("#mainmenu").hide();
    $("#d-nvstatus").text = ("Unknown");
    $("#d-bdaddr").text = ("Unknown");
}

function handleDisconnectedDevice(e) {
    console.log("disconnected");
    console.log("Disconnected: " + e.device.productName)
    disconnect();
}



function gboot() {
    gu = crypto.randomUUID();
    window.addEventListener('DOMContentLoaded', function () {
        ("#checkCircularity").on('change', on_circ_check_change);
        on_circ_check_change();
    });

    navigator.hid.addEventListener("disconnect", handleDisconnectedDevice);
}

function alloc_req(id, data = []) {
    len = data.length;
    try {
        fr = device.collections[0].featureReports;
        fr.forEach((e) => { if (e.reportId == id) { len = e.items[0].reportCount; } });
    } catch (e) {
        console.log(e);
    }
    out = new Uint8Array(len);
    for (i = 0; i < data.length && i < len; i++) {
        out[i] = data[i];
    }
    return out;
}

var last_lx = 0, last_ly = 0, last_rx = 0, last_ry = 0;
var ll_updated = false;

var ll_data = new Array(48);
var rr_data = new Array(48);
var enable_circ_test = false;

function reset_circularity() {
    for (i = 0; i < ll_data.length; i++) ll_data[i] = 0;
    for (i = 0; i < rr_data.length; i++) rr_data[i] = 0;
    enable_circ_test = false;
    ll_updated = false;
}




function on_circ_check_change() {
    enable_circ_test = circ_checked();
    for (i = 0; i < ll_data.length; i++) ll_data[i] = 0;
    for (i = 0; i < rr_data.length; i++) rr_data[i] = 0;

    if (enable_circ_test) {
        $("#circ-data").show();
    } else {
        $("#circ-data").hide();
    }
}

function float_to_str(f) {
    if (f < 0.004 && f >= -0.004) return "+0.00";
    return (f < 0 ? "" : "+") + f.toFixed(2);
}

var on_delay = false;

function timeout_ok() {
    on_delay = false;
    if (ll_updated)
        refresh_stick_pos();
}

function refresh_sticks() {
    if (on_delay)
        return;

    refresh_stick_pos();
    on_delay = true;
    setTimeout(timeout_ok, 20);
}

function process_ds4_input(data) {
    var lx = data.data.getUint8(0);
    var ly = data.data.getUint8(1);
    var rx = data.data.getUint8(2);
    var ry = data.data.getUint8(3);

    var new_lx = Math.round((lx - 127.5) / 128 * 100) / 100;
    var new_ly = Math.round((ly - 127.5) / 128 * 100) / 100;
    var new_rx = Math.round((rx - 127.5) / 128 * 100) / 100;
    var new_ry = Math.round((ry - 127.5) / 128 * 100) / 100;

    if (last_lx != new_lx || last_ly != new_ly || last_rx != new_rx || last_ry != new_ry) {
        last_lx = new_lx;
        last_ly = new_ly;
        last_rx = new_rx;
        last_ry = new_ry;
        ll_updated = true;
        refresh_sticks();
    }
}

function process_ds_input(data) {
    var lx = data.data.getUint8(0);
    var ly = data.data.getUint8(1);
    var rx = data.data.getUint8(2);
    var ry = data.data.getUint8(3);

    var new_lx = Math.round((lx - 127.5) / 128 * 100) / 100;
    var new_ly = Math.round((ly - 127.5) / 128 * 100) / 100;
    var new_rx = Math.round((rx - 127.5) / 128 * 100) / 100;
    var new_ry = Math.round((ry - 127.5) / 128 * 100) / 100;

    if (last_lx != new_lx || last_ly != new_ly || last_rx != new_rx || last_ry != new_ry) {
        last_lx = new_lx;
        last_ly = new_ly;
        last_rx = new_rx;
        last_ry = new_ry;
        ll_updated = true;
        refresh_sticks();
    }
}

async function continue_connection(report) {
    try {
        device.oninputreport = null;
        var reportLen = report.data.byteLength;

        var connected = false;

        // Detect if the controller is connected via USB
        if (reportLen != 63) {
            $("#btnconnect").prop("disabled", false);
            $("#connectspinner").hide();
            disconnect();
            show_popup(l("Please connect the device using a USB cable."))
            return;
        }

        if (device.productId == 0x05c4) {
            if (await ds4_info()) {
                connected = true;
                mode = 1;
                devname = l("Sony DualShock 4 V1");
                device.oninputreport = process_ds4_input;
            }
        } else if (device.productId == 0x09cc) {
            if (await ds4_info()) {
                connected = true;
                mode = 1;
                devname = l("Sony DualShock 4 V2");
                device.oninputreport = process_ds4_input;
            }
        } else if (device.productId == 0x0ce6) {
            if (await ds5_info()) {
                connected = true;
                mode = 2;
                devname = l("Sony DualSense");
                device.oninputreport = process_ds_input;
            }
        } else if (device.productId == 0x0df2) {
            if (await ds5_info()) {
                connected = true;
                mode = 0;
                devname = l("Sony DualSense Edge");
                disable_btn = true;
            }
        } else {
            $("#btnconnect").prop("disabled", false);
            $("#connectspinner").hide();
            show_popup(l("Connected invalid device: ") + dec2hex(device.vendorId) + ":" + dec2hex(device.productId))
            disconnect();
            return;
        }

        if (connected) {
            $("#devname").text(devname + " (" + dec2hex(device.vendorId) + ":" + dec2hex(device.productId) + ")");
            $("#offlinebar").hide();
            $("#onlinebar").show();
            $("#mainmenu").show();
            $("#resetBtn").show();
            $("#d-nvstatus").text = l("Unknown");
            $("#d-bdaddr").text = l("Unknown");
        } else {
            show_popup(l("Connected invalid device: ") + l("Error 1"));
            $("#btnconnect").prop("disabled", false);
            $("#connectspinner").hide();
            disconnect();
            return;
        }

        if (disable_btn) {
            if (device.productId == 0x0ce6) {
                show_popup(l("This DualSense controller has outdated firmware.") + "<br>" + l("Please update the firmware and try again."), true);
            } else if (device.productId == 0x0df2) {
                show_popup(l("Calibration of the DualSense Edge is not currently supported."));
            } else {
                show_popup(l("The device appears to be a DS4 clone. All functionalities are disabled."));
            }
        }

        $(".ds-btn").prop("disabled", disable_btn);

        $("#btnconnect").prop("disabled", false);
        $("#connectspinner").hide();
    } catch (error) {
        $("#btnconnect").prop("disabled", false);
        $("#connectspinner").hide();
        return;
    }
}

async function connect() {
    gj = crypto.randomUUID();
    reset_circularity();
    try {
        $("#btnconnect").prop("disabled", true);
        $("#connectspinner").show();
        await new Promise(r => setTimeout(r, 100));

        let ds4v1 = { vendorId: 0x054c, productId: 0x05c4 };
        let ds4v2 = { vendorId: 0x054c, productId: 0x09cc };
        let ds5 = { vendorId: 0x054c, productId: 0x0ce6 };
        let ds5edge = { vendorId: 0x054c, productId: 0x0df2 };
        let requestParams = { filters: [ds4v1, ds4v2, ds5, ds5edge] };

        var devices = await navigator.hid.getDevices();
        if (devices.length == 0) {
            devices = await navigator.hid.requestDevice(requestParams);
        }

        if (devices.length == 0) {
            $("#btnconnect").prop("disabled", false);
            $("#connectspinner").hide();
            return;
        }

        if (devices.length > 1) {
            $("#btnconnect").prop("disabled", false);
            $("#connectspinner").hide();
            show_popup(l("Please connect only one controller at time."));
            return;
        }

        await devices[0].open();

        device = devices[0]
        console.log("connect", { "p": device.productId, "v": device.vendorId });

        device.oninputreport = continue_connection

    } catch (error) {
        $("#btnconnect").prop("disabled", false);
        $("#connectspinner").hide();
        return;
    }
}

var curModal = null

async function multi_reset() {
    if (mode == 1)
        ds4_reset();
    else
        ds5_reset();
}

async function multi_getbdaddr() {
    if (mode == 1)
        ds4_getbdaddr();
    else
        ds5_getbdaddr();
}

async function multi_nvstatus() {
    if (mode == 1)
        ds4_nvstatus();
    else
        ds5_nvstatus();
}

async function multi_nvsunlock() {
    if (mode == 1) {
        await ds4_nvunlock();
        await ds4_nvstatus();
    } else {
        await ds5_nvunlock();
        await ds5_nvstatus();
    }
}

async function multi_nvslock() {
    if (mode == 1) {
        await ds4_nvlock();
        await ds4_nvstatus();
    } else {
        await ds5_nvlock();
        await ds5_nvstatus();
    }
}

async function multi_calib_sticks_begin(pc) {
    if (mode == 1)
        return ds4_calibrate_sticks_begin(pc);
    else
        return ds5_calibrate_sticks_begin(pc);
}

async function multi_calib_sticks_end(pc) {
    if (mode == 1)
        await ds4_calibrate_sticks_end(pc);
    else
        await ds5_calibrate_sticks_end(pc);
    on_circ_check_change();
}

async function multi_calib_sticks_sample() {
    if (mode == 1)
        return ds4_calibrate_sticks_sample();
    else
        return ds5_calibrate_sticks_sample();
}

var last_perm_ch = 0
async function multi_calibrate_range(perm_ch) {
    if (mode == 0)
        return;

    set_progress(0);
    curModal = new bootstrap.Modal(document.getElementById('rangeModal'), {})
    curModal.show();

    last_perm_ch = perm_ch

    await new Promise(r => setTimeout(r, 1000));

    if (mode == 1)
        ds4_calibrate_range_begin(perm_ch);
    else
        ds5_calibrate_range_begin(perm_ch);
}

async function multi_calibrate_range_on_close() {
    if (mode == 1)
        await ds4_calibrate_range_end(last_perm_ch);
    else
        await ds5_calibrate_range_end(last_perm_ch);
    on_circ_check_change();
}


async function multi_calibrate_sticks() {
    if (mode == 0)
        return;

    set_progress(0);
    curModal = new bootstrap.Modal(document.getElementById('calibrateModal'), {})
    curModal.show();

    await new Promise(r => setTimeout(r, 1000));

    if (mode == 1)
        ds4_calibrate_sticks();
    else
        ds5_calibrate_sticks();
}

function close_calibrate_window() {
    if (curModal != null) {
        curModal.hide();
        curModal = null;
    }

    cur_calib = 0;
    return;
}

function set_progress(i) {
    $(".progress-bar").css('width', '' + i + '%')
}

function clear_info() {
    $("#fwinfo").html("");
}

function append_info(key, value) {
    // TODO escape html
    var s = '<div class="hstack"><p>' + key + '</p><p class="ms-auto">' + value + '</p></div>';
    $("#fwinfo").html($("#fwinfo").html() + s);
}




function board_model_info() {
    console.log("bm_info");
    l1 = l("This feature is experimental.");
    l2 = l("Please let me know if the board model of your controller is not detected correctly.");
    l3 = l("Board model detection thanks to") + ' <a href="https://battlebeavercustoms.com/">Battle Beaver Customs</a>.';
    show_popup(l3 + "<br><br>" + l1 + " " + l2, true);
}

function calib_perm_changes() { return $("#calibPermanentChanges").is(':checked') }

function reset_calib_perm_changes() {
    $("#calibPermanentChanges").prop("checked", false).parent().removeClass('active');
}

function close_new_calib() {
    cur_calib = 0;
}

async function calib_step(i) {
    console.log("calib_step", { "i": i })
    if (i < 1 || i > 7) return;

    var pc = calib_perm_changes();
    var ret = true;
    if (i >= 2 && i <= 6) {
        $("#btnSpinner").show();
        $("#calibNext").prop("disabled", true);
    }

    if (i == 2) {
        $("#calibNextText").text(("Initializing..."));
        await new Promise(r => setTimeout(r, 100));
        ret = await multi_calib_sticks_begin(pc);
    } else if (i == 6) {
        $("#calibNextText").text(("Sampling..."));
        await new Promise(r => setTimeout(r, 100));
        ret = await multi_calib_sticks_sample();
        await new Promise(r => setTimeout(r, 100));
        $("#calibNextText").text(("Storing calibration..."));
        await new Promise(r => setTimeout(r, 100));
        ret = await multi_calib_sticks_end(pc);
    } else if (i > 2 && i < 6) {
        $("#calibNextText").text(("Sampling..."));
        await new Promise(r => setTimeout(r, 100));
        ret = await multi_calib_sticks_sample();
    }
    if (i >= 2 && i <= 6) {
        await new Promise(r => setTimeout(r, 200));
        $("#calibNext").prop("disabled", false);
        $("#btnSpinner").hide();
    }

    if (ret == false) {
        close_new_calib();
        return;
    }


}

var cur_calib = 0;
async function calib_open() {
    console.log("calib_open");
    cur_calib = 0;
    calib_perm_changes(true);
    await calib_next();
}

async function calib_next() {
    console.log("calib_next");
    if (cur_calib == 6) {
        close_new_calib()
        return;
    }
    if (cur_calib < 6) {
        cur_calib += 1;
        await calib_step(cur_calib);
    }
}

function refresh_stick_pos() {
    var c = document.getElementById("stickCanvas");
    var ctx = c.getContext("2d");
    var sz = 60;
    var hb = 20 + sz;
    var yb = 15 + sz;
    var w = c.width;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';

    // Left circle
    ctx.beginPath();
    ctx.arc(hb, yb, sz, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right circle
    ctx.beginPath();
    ctx.arc(w - hb, yb, sz, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    function cc_to_color(cc) {
        var dd = Math.sqrt(Math.pow((1.0 - cc), 2));
        if (cc <= 1.0)
            hh = 220 - 220 * Math.min(1.0, Math.max(0, (dd - 0.05)) / 0.1);
        else
            hh = (245 + (360 - 245) * Math.min(1.0, Math.max(0, (dd - 0.05)) / 0.15)) % 360;
        return hh;
    }

    if (enable_circ_test) {
        var MAX_N = ll_data.length;

        for (i = 0; i < MAX_N; i++) {
            var kd = ll_data[i];
            var kd1 = ll_data[(i + 1) % ll_data.length];
            if (kd === undefined || kd1 === undefined) continue;
            var ka = i * Math.PI * 2 / MAX_N;
            var ka1 = ((i + 1) % MAX_N) * 2 * Math.PI / MAX_N;

            var kx = Math.cos(ka) * kd;
            var ky = Math.sin(ka) * kd;
            var kx1 = Math.cos(ka1) * kd1;
            var ky1 = Math.sin(ka1) * kd1;

            ctx.beginPath();
            ctx.moveTo(hb, yb);
            ctx.lineTo(hb + kx * sz, yb + ky * sz);
            ctx.lineTo(hb + kx1 * sz, yb + ky1 * sz);
            ctx.lineTo(hb, yb);
            ctx.closePath();

            var cc = (kd + kd1) / 2;
            var hh = cc_to_color(cc);
            ctx.fillStyle = 'hsla(' + parseInt(hh) + ', 100%, 50%, 0.5)';
            ctx.fill();
        }

        for (i = 0; i < MAX_N; i++) {
            var kd = rr_data[i];
            var kd1 = rr_data[(i + 1) % rr_data.length];
            if (kd === undefined || kd1 === undefined) continue;
            var ka = i * Math.PI * 2 / MAX_N;
            var ka1 = ((i + 1) % MAX_N) * 2 * Math.PI / MAX_N;

            var kx = Math.cos(ka) * kd;
            var ky = Math.sin(ka) * kd;
            var kx1 = Math.cos(ka1) * kd1;
            var ky1 = Math.sin(ka1) * kd1;

            ctx.beginPath();
            ctx.moveTo(w - hb, yb);
            ctx.lineTo(w - hb + kx * sz, yb + ky * sz);
            ctx.lineTo(w - hb + kx1 * sz, yb + ky1 * sz);
            ctx.lineTo(w - hb, yb);
            ctx.closePath();

            var cc = (kd + kd1) / 2;
            var hh = cc_to_color(cc);
            ctx.fillStyle = 'hsla(' + parseInt(hh) + ', 100%, 50%, 0.5)';
            ctx.fill();
        }
    }

    ctx.strokeStyle = '#aaaaaa';
    ctx.beginPath();
    ctx.moveTo(hb - sz, yb);
    ctx.lineTo(hb + sz, yb);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w - hb - sz, yb);
    ctx.lineTo(w - hb + sz, yb);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hb, yb - sz);
    ctx.lineTo(hb, yb + sz);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w - hb, yb - sz);
    ctx.lineTo(w - hb, yb + sz);
    ctx.closePath();
    ctx.stroke();

    var plx = last_lx;
    var ply = last_ly;
    var prx = last_rx;
    var pry = last_ry;

    if (enable_circ_test) {
        var pld = Math.sqrt(plx * plx + ply * ply);
        var pla = (parseInt(Math.round(Math.atan2(ply, plx) * MAX_N / 2.0 / Math.PI)) + MAX_N) % MAX_N;
        var old = ll_data[pla];
        if (old === undefined) old = 0;
        ll_data[pla] = Math.max(old, pld);

        var prd = Math.sqrt(prx * prx + pry * pry);
        var pra = (parseInt(Math.round(Math.atan2(pry, prx) * MAX_N / 2.0 / Math.PI)) + MAX_N) % MAX_N;
        var old = rr_data[pra];
        if (old === undefined) old = 0;
        rr_data[pra] = Math.max(old, prd);
    }

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(hb + plx * sz, yb + ply * sz, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(hb, yb);
    ctx.lineTo(hb + plx * sz, yb + ply * sz);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w - hb + prx * sz, yb + pry * sz, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w - hb, yb);
    ctx.lineTo(w - hb + prx * sz, yb + pry * sz);
    ctx.stroke();

    var lbl = "", lbx = "";
    $("#lx-lbl").text(float_to_str(plx));
    $("#ly-lbl").text(float_to_str(ply));
    $("#rx-lbl").text(float_to_str(prx));
    $("#ry-lbl").text(float_to_str(pry));

    if (enable_circ_test) {
        var ofl = 0, ofr = 0, lcounter = 0, rcounter = 0;
        ofl = 0; ofr = 0;
        for (i = 0; i < ll_data.length; i++)
            if (ll_data[i] > 0.2) {
                lcounter += 1;
                ofl += Math.pow(ll_data[i] - 1, 2);
            }
        for (i = 0; i < rr_data.length; i++) {
            if (ll_data[i] > 0.2) {
                rcounter += 1;
                ofr += Math.pow(rr_data[i] - 1, 2);
            }
        }
        if (lcounter > 0)
            ofl = Math.sqrt(ofl / lcounter) * 100;
        if (rcounter > 0)
            ofr = Math.sqrt(ofr / rcounter) * 100;

        el = ofl.toFixed(2) + "%";
        er = ofr.toFixed(2) + "%";
        $("#el-lbl").text(el);
        $("#er-lbl").text(er);
    }
}

function lf(k, f) { console.log(k, buf2hex(f.buffer)); return f; }




document.addEventListener('DOMContentLoaded', function () {
    const leftJoystickCanvas = document.getElementById('leftJoystickCanvas');
    const rightJoystickCanvas = document.getElementById('rightJoystickCanvas');
    const leftJoystickPosition = document.getElementById('leftJoystickPosition');
    const rightJoystickPosition = document.getElementById('rightJoystickPosition');
    const leftCtx = leftJoystickCanvas.getContext('2d');
    const rightCtx = rightJoystickCanvas.getContext('2d');

    connect();

    const drawCrosshair = (ctx, centerX, centerY) => {
        const crosshairLength = 20; // Length of the crosshair lines
        ctx.strokeStyle = 'red'; // Color of the crosshair lines
        ctx.lineWidth = 2; // Thickness of the lines

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(centerX - crosshairLength, centerY);
        ctx.lineTo(centerX + crosshairLength, centerY);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - crosshairLength);
        ctx.lineTo(centerX, centerY + crosshairLength);
        ctx.stroke();
    };

    const drawJoystick = (ctx, x, y, positionElement) => {
        const centerX = 100;
        const centerY = 100;
        const radius = 80; // Radius of the joystick boundary

        // Clear the canvas
        ctx.clearRect(0, 0, 200, 200);

        // Draw the outer circle
        ctx.strokeStyle = 'blue'; // Color of the outer circle
        ctx.lineWidth = 4; // Thickness of the lines
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw centered crosshair
        ctx.strokeStyle = 'white'; // Color of the centered crosshair
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.stroke();

        // Draw line from current position to center
        ctx.strokeStyle = 'white'; // Color of the line from current position to center
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Draw joystick position circle
        ctx.fillStyle = 'red'; // Color of the joystick position circle
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 4);
        ctx.fill();

        // Update the position text under the joystick
        const normalizedX = (x - 100) / 80;
        const normalizedY = (y - 100) / 80;
        positionElement.textContent = `X: ${normalizedX.toFixed(3)}, Y: ${normalizedY.toFixed(3)}`;
    };

    const updateJoysticks = () => {
        const gamepads = navigator.getGamepads();
        const leftJoystickPosition = document.getElementById('leftJoystickPosition'); // Get left joystick position element
        const rightJoystickPosition = document.getElementById('rightJoystickPosition'); // Get right joystick position element

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                const leftX = gp.axes[0] * 80 + 100; // Calculate position for left joystick
                const leftY = gp.axes[1] * 80 + 100;
                drawJoystick(leftCtx, leftX, leftY, leftJoystickPosition); // Pass left position element

                const rightX = gp.axes[2] * 80 + 100; // Calculate position for right joystick
                const rightY = gp.axes[3] * 80 + 100;
                drawJoystick(rightCtx, rightX, rightY, rightJoystickPosition); // Pass right position element
            }
        }
        requestAnimationFrame(updateJoysticks);
    };

    window.addEventListener('gamepadconnected', () => {
        console.log('Gamepad connected');
        requestAnimationFrame(updateJoysticks);
    });

    window.addEventListener('gamepaddisconnected', () => {
        console.log('Gamepad disconnected');
    });
});



document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById("calModal");
    const closeBtn = document.querySelector(".close");

    // Function to show the modal
    function showModal(message) {
        const modalMessage = document.getElementById("modalMessage");
        modalMessage.textContent = message;
        modal.style.display = "flex";
    }

    // Function to close the modal
    function closeModal() {
        modal.style.display = "none";
    }

    // Event listener for the close button
  
    // Event listener to close modal when clicking outside of it
    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Example usage

});


// Function to save gamepad axes readings to local storage


document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById("calModal");
    const modalMessage = document.getElementById("modalMessage");
    const calibrationMessageDiv = document.getElementById("calibrationMessage");

    window.addEventListener("gamepadconnected", function (e) {
        console.log("A gamepad connected:", e.gamepad);
        saveJoystickReadings();
        if (modal.style.display === "flex") { // Check if modal is displayed
            startCalibration(e.gamepad); // Pass the connected gamepad object
        }
    });

    const toggleCheckbox = document.getElementById('toggleReadings');



    ////add range cal function




    function startCalibration(gamepad) {
        let longController = gamepad.id;
        localStorage.setItem("longController", longController);
        let shortController = gamepad.id.split('(')[0].trim();
        localStorage.setItem("shortController", shortController);
        if (shortController === "DualSense Wireless Controller") {
            updateCalibrationMessage(1); // Display the initial calibration message
            checkGamepadInput();
        }
    }

    let currentStep = 0; // Starting at first calibration step
    let currentCorner = 1; // Starting at the first corner for glow

    function checkGamepadInput() {
        let leftStickTarget = document.getElementById("leftJoystickCanvas");
        let rightStickTarget = document.getElementById("rightJoystickCanvas");

        function pollGamepad() {
            const gamepads = navigator.getGamepads();

            const gamepad = gamepads[0]; // Assuming the first gamepad
            if (gamepad) {

                if (gamepad.buttons[0].pressed) {
                    console.log("X button pressed");
                    connect();
                    document.getElementById('startInst').style.display = 'none';
                    document.getElementById('calWarning').style.display = 'block';


                    if (currentStep <= 4) {
                        // Glow management
                        leftStickTarget.classList.remove(targetCorner[currentCorner]);
                        rightStickTarget.classList.remove(targetCorner[currentCorner]);
                        currentCorner = currentStep;
                        leftStickTarget.classList.add(targetCorner[currentCorner]);
                        rightStickTarget.classList.add(targetCorner[currentCorner]);
                    }

                    if (currentStep === 1) {
                        document.getElementById('calWarning').style.display = 'none';
                        connect();
                        saveJoystickReadings();
                        ds5_nvunlock();
                        ds5_calibrate_sticks_begin(true);
                        
                        calib_open();
                        calib_next();
                    } else if (currentStep === 2) {
                        document.getElementById('calWarning').style.display = 'none';
                        calib_next();
                    }
                    else if (currentStep >= 3 && currentStep < 5) {
                        document.getElementById('calWarning').style.display = 'none';
                        calib_next();
                    } else if (currentStep === 5) {
                        leftStickTarget.classList.remove(targetCorner[currentCorner]);
                        rightStickTarget.classList.remove(targetCorner[currentCorner]);
                        leftStickTarget.classList.add("glow-full-circle");
                        rightStickTarget.classList.add("glow-full-circle");
                        document.getElementById('calWarning').style.display = 'block';
                        

                    } else if (currentStep === 6) {
                        leftStickTarget.classList.remove(targetCorner[currentCorner]);
                        rightStickTarget.classList.remove(targetCorner[currentCorner]);
                        calibrationMessageDiv.textContent = "Calibration completed successfully!";
                        let calTime = new Date();

                        console.log("Calibration completed.");
                        localStorage.setItem("CalResult", "Pass");
                        ds5_calibrate_sticks_end(true);
                        ds5_nvlock();
                        window.close();



                    }

                    currentStep++;
                    updateCalibrationMessage(currentStep);
                    setTimeout(() => requestAnimationFrame(pollGamepad), 1000);
                } else {
                    requestAnimationFrame(pollGamepad);
                }
            } else {
                console.log("No gamepad detected");
                requestAnimationFrame(pollGamepad);
            }
        }
        requestAnimationFrame(pollGamepad);
    }

    function updateCalibrationMessage(step) {
        const calibrationMessages = {
            1: "Press 'X' to begin calibration ",
            2: "Move sticks to top left and release, then press 'X'",
            3: "Move to top right and release, then press 'X'",
            4: "Move to bottom left and release, then press 'X'",
            5: "Move to bottom right and release, then press 'X'",
            6: "Finalizing calibration... Press 'X' to continue."
        };

        const message = calibrationMessages[step];
        if (message) {
            calibrationMessageDiv.textContent = message;
        }
    }

    const targetCorner = {
        1: "glow-upper-left",
        2: "glow-upper-right",
        3: "glow-bottom-left",
        4: "glow-bottom-right"
    };

    // Start polling for gamepads when the page loads
    checkGamepadInput();
});


function saveJoystickReadings() {
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) { // Assuming the first gamepad is the one you're interested in
        const gp = gamepads[0];

        const joystickReadings = {
            "Left Stick": [gp.axes[0].toFixed(6), gp.axes[1].toFixed(6)],
            "Right Stick": [gp.axes[2].toFixed(6), gp.axes[3].toFixed(6)]
        };

        // Convert the joystick readings to a JSON string before saving
        localStorage.setItem('preCalJoystick', JSON.stringify(joystickReadings));
        console.log("Joystick readings saved:", joystickReadings);
    } else {
        console.log("No gamepad detected.");
    }
}
